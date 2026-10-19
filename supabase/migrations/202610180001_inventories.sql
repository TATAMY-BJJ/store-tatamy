-- Apply only after the preflight described in docs/inventories.md.
BEGIN;
ALTER TABLE public.items ADD COLUMN item_type text NOT NULL DEFAULT 'unclassified'
  CHECK (item_type IN ('unclassified', 'asset', 'consumable'));
ALTER TABLE public.items ADD COLUMN last_checked_at timestamptz;
ALTER TABLE public.items ADD COLUMN last_checked_date date;
-- Preserve the original free-text quantity separately from the numeric count.
-- It is reference information, never an input to stock arithmetic.
ALTER TABLE public.items ADD COLUMN legacy_quantity text;
UPDATE public.items SET legacy_quantity=quantity
 WHERE quantity IS NOT NULL AND trim(quantity) <> ''
 AND trim(quantity) !~ '^[0-9]+([.,][0-9]+)?$';

CREATE TABLE public.inventories (
  id serial PRIMARY KEY,
  inventory_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE UNIQUE INDEX inventories_one_open ON public.inventories(status) WHERE status = 'open';
CREATE TABLE public.inventory_entries (
  id serial PRIMARY KEY,
  inventory_id integer NOT NULL REFERENCES public.inventories(id),
  -- Deliberately no FK to live items: deletion must not erase history.
  item_id integer NOT NULL,
  item_name text NOT NULL,
  box_id integer NOT NULL,
  box_name text NOT NULL,
  item_type text NOT NULL,
  minimum text,
  original_quantity text,
  legacy_quantity text,
  original_note text,
  expected_total numeric,
  counted numeric CHECK (counted >= 0),
  lent numeric,
  lending_snapshot jsonb,
  checked_date date,
  checked_at timestamptz,
  UNIQUE(inventory_id, item_id)
);
CREATE TABLE public.lending_history (
  id serial PRIMARY KEY,
  lending_id integer NOT NULL,
  item_id integer NOT NULL,
  item_name text NOT NULL,
  lent_to text NOT NULL,
  quantity text NOT NULL,
  note text,
  lent_at timestamptz NOT NULL,
  returned_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lending_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventories, public.inventory_entries, public.lending_history FROM anon, authenticated;
GRANT ALL ON public.inventories, public.inventory_entries, public.lending_history TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.inventories_id_seq, public.inventory_entries_id_seq, public.lending_history_id_seq TO service_role;

CREATE FUNCTION public.stock_number(value text) RETURNS numeric
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT CASE WHEN trim(value) ~ '^[0-9]+([.,][0-9]+)?$' THEN replace(trim(value), ',', '.')::numeric END
$$;

CREATE FUNCTION public.start_inventory(p_date date) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE result integer;
BEGIN
 LOCK TABLE items IN SHARE ROW EXCLUSIVE MODE;
 IF p_date IS NULL OR p_date > (now() AT TIME ZONE 'Europe/Prague')::date THEN
   RAISE EXCEPTION 'Zvolte datum kontroly, nejpozději dnešní.';
 END IF;
 INSERT INTO inventories(inventory_date) VALUES(p_date) RETURNING id INTO result;
 INSERT INTO inventory_entries(inventory_id,item_id,item_name,box_id,box_name,item_type,minimum,original_quantity,legacy_quantity,original_note)
 SELECT result,i.id,i.name,b.id,b.name,i.item_type,i.min_quantity,i.quantity,i.legacy_quantity,i.note FROM items i JOIN boxes b ON b.id=i.box_id;
 RETURN result;
END $$;

CREATE FUNCTION public.check_inventory_item(p_inventory integer,p_item integer,p_count numeric,p_date date)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE inv inventories; it items; entry inventory_entries; loans numeric; snapshot jsonb; expected numeric;
BEGIN
 SELECT * INTO inv FROM inventories WHERE id=p_inventory FOR UPDATE;
 IF NOT FOUND OR inv.status <> 'open' THEN RAISE EXCEPTION 'Inventura není rozpracovaná.'; END IF;
 IF p_count IS NULL OR p_count < 0 OR p_count::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Zadejte nezáporný počet.'; END IF;
 IF p_date IS NULL OR p_date < inv.inventory_date OR p_date > (now() AT TIME ZONE 'Europe/Prague')::date THEN RAISE EXCEPTION 'Datum kontroly musí být mezi začátkem inventury a dneškem.'; END IF;
 SELECT * INTO it FROM items WHERE id=p_item FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Položka již neexistuje.'; END IF;
 IF it.item_type='unclassified' THEN RAISE EXCEPTION 'Nejdřív vyberte typ položky.'; END IF;
 SELECT * INTO entry FROM inventory_entries WHERE inventory_id=p_inventory AND item_id=p_item;
 IF NOT FOUND THEN RAISE EXCEPTION 'Položka není součástí inventury.'; END IF;
 IF EXISTS(SELECT 1 FROM lendings WHERE item_id=p_item AND stock_number(quantity) IS NULL) THEN RAISE EXCEPTION 'Nejdřív opravte nečíselný počet výpůjčky.'; END IF;
 SELECT coalesce(sum(stock_number(quantity)),0),coalesce(jsonb_agg(jsonb_build_object('lent_to',lent_to,'quantity',quantity)),'[]')
 INTO loans,snapshot FROM lendings WHERE item_id=p_item;
 expected := CASE WHEN entry.checked_at IS NOT NULL THEN entry.expected_total ELSE stock_number(it.quantity)+loans END;
 -- Unknown old quantities establish a baseline; they must not invent a loss.
 UPDATE inventory_entries SET item_name=it.name, item_type=it.item_type, minimum=it.min_quantity,
   original_quantity=CASE WHEN entry.checked_at IS NULL THEN it.quantity ELSE entry.original_quantity END,
   original_note=CASE WHEN entry.checked_at IS NULL THEN it.note ELSE entry.original_note END,
   legacy_quantity=coalesce(it.legacy_quantity, CASE WHEN stock_number(it.quantity) IS NULL THEN it.quantity END),
   box_id=it.box_id,box_name=(SELECT name FROM boxes WHERE id=it.box_id),
   expected_total=expected,counted=p_count,lent=loans,lending_snapshot=snapshot,checked_date=p_date,checked_at=now()
 WHERE id=entry.id;
 UPDATE items SET quantity=p_count::text,last_checked_at=now(),last_checked_date=p_date,
   legacy_quantity=coalesce(it.legacy_quantity, CASE WHEN stock_number(it.quantity) IS NULL THEN it.quantity END)
 WHERE id=p_item;
END $$;

CREATE FUNCTION public.close_inventory(p_inventory integer) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE inv inventories;
BEGIN
 SELECT * INTO inv FROM inventories WHERE id=p_inventory FOR UPDATE;
 IF NOT FOUND OR inv.status <> 'open' THEN RAISE EXCEPTION 'Inventura není rozpracovaná.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM inventory_entries WHERE inventory_id=p_inventory) OR EXISTS(SELECT 1 FROM inventory_entries WHERE inventory_id=p_inventory AND checked_at IS NULL) THEN
 RAISE EXCEPTION 'Nejdřív zkontrolujte všechny položky inventury.'; END IF;
 UPDATE inventories SET status='closed',closed_at=now() WHERE id=p_inventory;
END $$;

CREATE FUNCTION public.protect_inventory_history() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF TG_TABLE_NAME='inventories' THEN
   IF OLD.status='closed' THEN RAISE EXCEPTION 'Uzavřenou inventuru nelze měnit.'; END IF;
 ELSE
   IF EXISTS(SELECT 1 FROM inventories WHERE id=CASE WHEN TG_OP='INSERT' THEN NEW.inventory_id ELSE OLD.inventory_id END AND status='closed')
     OR (TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM inventories WHERE id=NEW.inventory_id AND status='closed'))
     THEN RAISE EXCEPTION 'Historii inventury nelze měnit.'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_inventory BEFORE UPDATE OR DELETE ON inventories FOR EACH ROW EXECUTE FUNCTION protect_inventory_history();
CREATE TRIGGER protect_inventory_entry BEFORE INSERT OR UPDATE OR DELETE ON inventory_entries FOR EACH ROW EXECUTE FUNCTION protect_inventory_history();

-- New items join an open inventory; deletion is blocked until that inventory closes.
CREATE FUNCTION public.inventory_item_lifecycle() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE inv integer;
BEGIN
 SELECT id INTO inv FROM inventories WHERE status='open' FOR UPDATE;
 IF TG_OP='DELETE' THEN
   IF inv IS NOT NULL THEN RAISE EXCEPTION 'Položky mažte až po uzavření inventury.'; END IF;
   IF EXISTS(SELECT 1 FROM lendings WHERE item_id=OLD.id) THEN RAISE EXCEPTION 'Nejdřív vraťte výpůjčky položky.'; END IF;
   RETURN OLD;
 END IF;
 IF inv IS NOT NULL THEN
 INSERT INTO inventory_entries(inventory_id,item_id,item_name,box_id,box_name,item_type,minimum,original_quantity,legacy_quantity,original_note)
 SELECT inv,NEW.id,NEW.name,NEW.box_id,b.name,NEW.item_type,NEW.min_quantity,NEW.quantity,NEW.legacy_quantity,NEW.note FROM boxes b WHERE b.id=NEW.box_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER inventory_new_item AFTER INSERT ON items FOR EACH ROW EXECUTE FUNCTION inventory_item_lifecycle();
CREATE TRIGGER inventory_delete_item BEFORE DELETE ON items FOR EACH ROW EXECUTE FUNCTION inventory_item_lifecycle();

CREATE FUNCTION public.lending_stock_movement() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE it items; qty numeric; available numeric;
BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Výpůjčku vraťte a vytvořte novou.'; END IF;
 SELECT * INTO it FROM items WHERE id=CASE WHEN TG_OP='INSERT' THEN NEW.item_id ELSE OLD.item_id END FOR UPDATE;
 qty := stock_number(CASE WHEN TG_OP='INSERT' THEN NEW.quantity ELSE OLD.quantity END);
 available := stock_number(it.quantity);
 IF qty IS NULL OR qty<=0 OR available IS NULL THEN RAISE EXCEPTION 'Počet ve skladu i výpůjčce musí být číselný, výpůjčka kladná.'; END IF;
 IF TG_OP='INSERT' THEN
   IF qty>available THEN RAISE EXCEPTION 'Ve skladu není dost kusů k půjčení.'; END IF;
   UPDATE items SET quantity=(available-qty)::text WHERE id=it.id;
   RETURN NEW;
 END IF;
 INSERT INTO lending_history(lending_id,item_id,item_name,lent_to,quantity,note,lent_at)
 VALUES(OLD.id,it.id,it.name,OLD.lent_to,OLD.quantity,OLD.note,OLD.created_at);
 UPDATE items SET quantity=(available+qty)::text WHERE id=it.id;
 RETURN OLD;
END $$;
CREATE TRIGGER lending_movement BEFORE INSERT OR UPDATE OR DELETE ON lendings FOR EACH ROW EXECUTE FUNCTION lending_stock_movement();

REVOKE EXECUTE ON FUNCTION public.start_inventory(date),public.check_inventory_item(integer,integer,numeric,date),public.close_inventory(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_inventory(date),public.check_inventory_item(integer,integer,numeric,date),public.close_inventory(integer) TO service_role;
COMMIT;

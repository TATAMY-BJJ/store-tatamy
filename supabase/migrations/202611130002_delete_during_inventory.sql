BEGIN;
-- An open inventory used to reject every item delete. The editor then put the
-- item back at the end of the box, so it looked moved rather than removed.
-- Deleting during a count drops only that open row. Closed history has no
-- foreign key to the live item and stays unchanged. Active loans still block.
CREATE OR REPLACE FUNCTION public.inventory_item_lifecycle() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE inv integer;
BEGIN
 SELECT id INTO inv FROM inventories WHERE status='open' FOR UPDATE;
 IF TG_OP='DELETE' THEN
   IF EXISTS(SELECT 1 FROM lendings WHERE item_id=OLD.id) THEN RAISE EXCEPTION 'Nejdřív vraťte výpůjčky položky.'; END IF;
   IF inv IS NOT NULL THEN
     DELETE FROM inventory_entries WHERE inventory_id=inv AND item_id=OLD.id;
   END IF;
   RETURN OLD;
 END IF;
 IF inv IS NOT NULL THEN
 INSERT INTO inventory_entries(inventory_id,item_id,item_name,box_id,box_name,item_type,minimum,original_quantity,legacy_quantity,original_note)
 SELECT inv,NEW.id,NEW.name,NEW.box_id,b.name,NEW.item_type,NEW.min_quantity,NEW.quantity,NEW.legacy_quantity,NEW.note FROM boxes b WHERE b.id=NEW.box_id;
 END IF;
 RETURN NEW;
END $$;
COMMIT;

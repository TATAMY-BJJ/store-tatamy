import Image from 'next/image';

export default function ItemPhotos({ photos = [], name }: { photos?: string[]; name: string }) {
  if (!photos.length) return null;
  return <div className="flex flex-wrap gap-2 py-2">
    {photos.map((url, index) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" aria-label={`Zvětšit fotografii ${index + 1}: ${name}`} className="rounded-lg border border-gray-200 focus-visible:outline-2 focus-visible:outline-tatamy-red">
      <Image unoptimized src={url} width={72} height={72} alt={`${name}, fotografie ${index + 1}`} className="h-18 w-18 rounded-lg object-contain bg-white" />
    </a>)}
  </div>;
}

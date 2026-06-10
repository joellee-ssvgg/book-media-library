import Image from "next/image";
import { cn } from "@/lib/utils";
import { normalizeRemoteImageSrc } from "@/lib/images";

export function CoverImage({
  src,
  alt = "",
  className,
  imageClassName = "object-cover",
  sizes = "200px",
  priority = false,
  as: Tag = "div",
}) {
  const optimizedSrc = normalizeRemoteImageSrc(src);
  return (
    <Tag className={cn("relative block overflow-hidden", className)}>
      {optimizedSrc ? (
        <Image
          src={optimizedSrc}
          alt={alt}
          fill
          sizes={sizes}
          className={imageClassName}
          priority={priority}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={cn("h-full w-full", imageClassName)}
          loading={priority ? undefined : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
        />
      )}
    </Tag>
  );
}

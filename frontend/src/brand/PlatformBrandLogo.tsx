import type { CSSProperties, ReactNode } from "react";

import { DefaultBrandMark } from "./DefaultBrandMark";
import { brandInitials, DEFAULT_PLATFORM_BRAND_NAME, usesDefaultLandingWordmark } from "./platformBrand";
import { usePlatformBrand } from "./PlatformBrandContext";

type PlatformBrandMarkProps = {
  className?: string;
  imgClassName?: string;
};

export function PlatformBrandMark({ className, imgClassName }: PlatformBrandMarkProps) {
  const { brandName, logoUrl } = usePlatformBrand();

  if (logoUrl) {
    return (
      <img
        alt={brandName}
        className={imgClassName ?? className ?? "platform-brand-mark-img"}
        src={logoUrl}
      />
    );
  }

  return <DefaultBrandMark className={className} />;
}

type PlatformBrandTitleProps = {
  className?: string;
  /** Landing lime split title — only for default wordmark without custom logo. */
  landing?: boolean;
};

export function PlatformBrandTitle({ className, landing = false }: PlatformBrandTitleProps) {
  const brand = usePlatformBrand();

  if (landing && usesDefaultLandingWordmark(brand)) {
    return (
      <span className={className ?? "lpx-logo-title"}>
        <span className="lpx-logo-title-lime">Noren</span>Digital
        <span className="lpx-logo-title-dot">.</span>
      </span>
    );
  }

  return <span className={className}>{brand.brandName}</span>;
}

type PlatformBrandTextProps = {
  className?: string;
  /** Highlight second half like admin login shell. */
  split?: boolean;
  /** Render wordmark even when a custom logo URL is configured. */
  withLogo?: boolean;
};

function renderSplitWordmark(className?: string) {
  return (
    <span className={className}>
      Noren<span>Digital</span>
    </span>
  );
}

export function PlatformBrandText({ className, split = false, withLogo = false }: PlatformBrandTextProps) {
  const { brandName, logoUrl } = usePlatformBrand();

  if (logoUrl && !withLogo) {
    return <PlatformBrandMark className={className} imgClassName={className} />;
  }

  if (split && brandName === DEFAULT_PLATFORM_BRAND_NAME) {
    return renderSplitWordmark(className);
  }

  return <span className={className}>{brandName}</span>;
}

type PlatformBrandAvatarProps = {
  className?: string;
};

export function PlatformBrandAvatar({ className }: PlatformBrandAvatarProps) {
  const brand = usePlatformBrand();

  if (brand.logoUrl) {
    return (
      <img
        alt=""
        aria-hidden
        className={className ?? "platform-brand-avatar-img"}
        src={brand.logoUrl}
      />
    );
  }

  return <span className={className}>{brandInitials(brand.brandName)}</span>;
}

type PlatformBrandBlockProps = {
  markClassName?: string;
  titleClassName?: string;
  subtitle?: ReactNode;
  subtitleClassName?: string;
  landingTitle?: boolean;
  hideTitleWhenLogo?: boolean;
};

export function PlatformBrandBlock({
  markClassName,
  titleClassName,
  subtitle,
  subtitleClassName,
  landingTitle = false,
  hideTitleWhenLogo = false,
}: PlatformBrandBlockProps) {
  const brand = usePlatformBrand();
  const showTitle = !(hideTitleWhenLogo && brand.logoUrl);

  return (
    <>
      <PlatformBrandMark className={markClassName} />
      {showTitle ? (
        <div className={titleClassName ? undefined : "lpx-logo-text"}>
          <PlatformBrandTitle className={titleClassName ?? "lpx-logo-title"} landing={landingTitle} />
          {subtitle ? <span className={subtitleClassName ?? "lpx-logo-sub"}>{subtitle}</span> : null}
        </div>
      ) : null}
    </>
  );
}

type PlatformBrandImageProps = {
  className?: string;
  style?: CSSProperties;
};

/** Full-width logo image (SVG/PNG) without fallback mark. */
export function PlatformBrandImage({ className, style }: PlatformBrandImageProps) {
  const { brandName, logoUrl } = usePlatformBrand();

  if (!logoUrl) {
    return null;
  }

  return <img alt={brandName} className={className} src={logoUrl} style={style} />;
}

export { usePlatformBrand };

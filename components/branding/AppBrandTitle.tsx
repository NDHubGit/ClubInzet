import type { CSSProperties } from "react";

type AppBrandTitleProps = {
  /** Tekst naast het logo (default: ClubInzet). */
  title?: string;
  /** Hoogte/breedte van het logo-icoon in px. */
  iconSize?: number;
  /** Titel font-size (px). */
  titleSize?: number;
  style?: CSSProperties;
  className?: string;
};

/**
 * Herbruikbare kopregel: vectorlogo + titel (donker thema).
 */
export default function AppBrandTitle({
  title = "ClubInzet",
  iconSize = 40,
  titleSize = 30,
  style,
  className,
}: AppBrandTitleProps) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 0,
        ...style,
      }}
    >
      <img
        src="/logo.svg"
        alt=""
        width={iconSize}
        height={iconSize}
        style={{ flexShrink: 0, display: "block" }}
      />
      <span
        style={{
          margin: 0,
          fontSize: titleSize,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "#f8fafc",
          lineHeight: 1.1,
        }}
      >
        {title}
      </span>
    </div>
  );
}

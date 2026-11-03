import { CrmLink as Link } from "./hash-nav";
import { Button } from "./crm-ui";

export function CrmEmpty({
  title,
  text,
  actionHref,
  actionLabel,
}: {
  title: string;
  text: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="crm-v3-empty">
      <p className="crm-label" style={{ margin: 0 }}>
        Vazio
      </p>
      <h3>{title}</h3>
      <p>{text}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref}>
          <Button variant="secondary">{actionLabel}</Button>
        </Link>
      )}
    </div>
  );
}

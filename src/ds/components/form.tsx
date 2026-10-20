import * as React from 'react';
import { cx } from './cx';

type FieldProps = { label?: string; help?: string; error?: string };

function Field({ id, label, help, error, children }: FieldProps & { id: string; children: React.ReactNode }) {
  return (
    <div className="ds-field">
      {label && <label htmlFor={id} className="ds-field__label">{label}</label>}
      {children}
      {error ? <span id={`${id}-d`} className="ds-field__error">{error}</span> : help ? <span id={`${id}-d`} className="ds-field__help">{help}</span> : null}
    </div>
  );
}

export function Input({ label, help, error, id, className, ...rest }: React.ComponentProps<'input'> & FieldProps) {
  const auto = React.useId(); const iid = id ?? auto;
  return (
    <Field id={iid} label={label} help={help} error={error}>
      <input {...rest} id={iid} aria-invalid={error ? true : undefined} aria-describedby={error || help ? `${iid}-d` : undefined} className={cx('ds-input', className)} />
    </Field>
  );
}

export function Textarea({ label, help, error, id, className, ...rest }: React.ComponentProps<'textarea'> & FieldProps) {
  const auto = React.useId(); const iid = id ?? auto;
  return (
    <Field id={iid} label={label} help={help} error={error}>
      <textarea {...rest} id={iid} aria-invalid={error ? true : undefined} aria-describedby={error || help ? `${iid}-d` : undefined} className={cx('ds-textarea', className)} />
    </Field>
  );
}

/** Select nativo estilizado: teclado, leitor de tela e menu do sistema funcionam de graça. */
export function Select({ label, help, error, id, className, children, ...rest }: React.ComponentProps<'select'> & FieldProps) {
  const auto = React.useId(); const iid = id ?? auto;
  return (
    <Field id={iid} label={label} help={help} error={error}>
      <select {...rest} id={iid} aria-invalid={error ? true : undefined} aria-describedby={error || help ? `${iid}-d` : undefined} className={cx('ds-select', className)}>{children}</select>
    </Field>
  );
}

export function Checkbox({ label, className, ...rest }: Omit<React.ComponentProps<'input'>, 'type'> & { label: React.ReactNode }) {
  return <label className={cx('ds-check', className)}><input {...rest} type="checkbox" /><span>{label}</span></label>;
}

export function Radio({ label, className, ...rest }: Omit<React.ComponentProps<'input'>, 'type'> & { label: React.ReactNode }) {
  return <label className={cx('ds-radio', className)}><input {...rest} type="radio" /><span>{label}</span></label>;
}

/** Switch acessível: checkbox nativo com role="switch". */
export function Switch({ label, className, ...rest }: Omit<React.ComponentProps<'input'>, 'type' | 'role'> & { label: React.ReactNode }) {
  return <label className={cx('ds-switchrow', className)}><input {...rest} type="checkbox" role="switch" className="ds-switch" /><span>{label}</span></label>;
}

import { useId, type InputHTMLAttributes } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  etiqueta: string;
  error?: string;
  ayuda?: string;
}

/** Campo con etiqueta visible, ayuda y error asociados para lectores de pantalla. */
export function CampoTexto({ etiqueta, error, ayuda, ...input }: Props) {
  const id = useId();
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  const idError = error ? `${id}-error` : undefined;
  const describe = [idAyuda, idError].filter(Boolean).join(' ') || undefined;
  return (
    <div className="mf-campo">
      <label htmlFor={id}>{etiqueta}</label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe}
        {...input}
      />
      {ayuda && (
        <p id={idAyuda} className="mf-campo__ayuda">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} className="mf-campo__error">
          {error}
        </p>
      )}
    </div>
  );
}

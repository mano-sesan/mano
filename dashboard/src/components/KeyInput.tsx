import { useEffect, useRef, useState } from "react";
import { DEFAULT_ORGANISATION_KEY } from "../config";

// Un faux champ password pour la clé de chiffrement.
//
// Limites identifiées actuellement :
// - Les caractères ^ et ¨ ne sont pas correctement gérés (en gros, tous les caractères qui se font en 2 temps)
// - Pas de copier/coller (on peut voir ça comme une sécurité)
// - On ne peut pas déplacer le curseur, il est toujours à la fin.
const KeyInput = ({
  onChange,
  onPressEnter,
}: {
  onChange: (value: string) => void;
  onPressEnter: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}) => {
  const inputRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState<string>("");

  useEffect(() => {
    if (DEFAULT_ORGANISATION_KEY) {
      setValue(DEFAULT_ORGANISATION_KEY);
      inputRef.current.innerText = "•".repeat(DEFAULT_ORGANISATION_KEY.length);
    }
  }, []);

  return (
    <div
      contentEditable
      ref={inputRef}
      onPaste={(e) => {
        // Pas de copier/coller
        e.preventDefault();
      }}
      onKeyDown={(e) => {
        // 1. On ne veut pas rajouter de caractère "entrée"
        // 2. On envoie la clé
        if (e.key === "Enter") {
          e.preventDefault();
          onPressEnter(e);
        }
      }}
      onDoubleClick={(e) => {
        // Gestion de la sélection de tout le texte (car il est en contradiction avec les onSelect)
        e.preventDefault();
        e.stopPropagation();
        document.getSelection().selectAllChildren(inputRef.current);
      }}
      onSelect={(e) => {
        e.preventDefault();
        // Toute sélection est désactivée, sauf si on a sélectionné tout le texte
        if (document.getSelection().toString().length !== inputRef.current.innerText.length) {
          document.getSelection().selectAllChildren(inputRef.current);
          document.getSelection().collapseToEnd();
        }
      }}
      onInput={(e) => {
        const innerText = (e.target as HTMLElement).innerText;
        let newValue: string;

        if (innerText.length === value.length + 1) {
          // 1 caractère en plus à la fin
          const newChar = innerText.slice(-1);
          newValue = value + newChar;
        } else if (innerText.length + 1 === value.length) {
          // 1 caractère en moins à la fin
          newValue = value.slice(0, -1);
        } else {
          // Autre cas
          newValue = innerText;
        }

        // Cas particulier en cas d'erreur (si la personne a forcé le déplacement du curseur par exemple)
        if (newValue.includes("•")) {
          newValue = "";
        }

        onChange(newValue);
        setValue(newValue);
        (e.target as HTMLElement).innerText = "•".repeat(newValue.length);
        // On déplace le curseur à la fin
        document.getSelection().selectAllChildren(inputRef.current);
        document.getSelection().collapseToEnd();
      }}
      autoCorrect="off"
      spellCheck="false"
      className="!tw-select-none tw-mb-1.5 tw-block tw-w-full tw-rounded tw-border tw-border-main75 tw-bg-transparent tw-p-2.5 tw-text-black tw-outline-main tw-transition-all"
    />
  );
};

export default KeyInput;

import { useEffect, useRef, useState } from "react";
import { DEFAULT_ORGANISATION_KEY } from "../config";

// Un faux champ password pour la clé de chiffrement.
//
// Limites identifiées actuellement :
// - Pas de copier/coller (on peut voir ça comme une sécurité)
// - On ne peut pas déplacer le curseur, il est toujours à la fin.
const KeyInput = ({
  id,
  onChange,
  onPressEnter,
}: {
  id: string;
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

  function setCursorToEnd() {
    document.getSelection().selectAllChildren(inputRef.current);
    document.getSelection().collapseToEnd();
  }

  return (
    <div
      id={id}
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
          setCursorToEnd();
        }
      }}
      onCompositionEnd={(e) => {
        // Gestion des caractères en 2 temps (similaire à l'ajout d'un caractère à la fin).
        const innerText = (e.target as HTMLElement).innerText;
        const newValue = value + innerText.slice(-1);
        onChange(newValue);
        setValue(newValue);
        (e.target as HTMLElement).innerText = "•".repeat(newValue.length);
        setCursorToEnd();
      }}
      onInput={(e) => {
        // Cas particulier: Si on est en train de faire une composition (comme ^ + i pour î par exemple), on gère à l'extérieur.
        if ((e.nativeEvent as InputEvent).isComposing) return;

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

        // Replace non-breaking spaces by normal spaces
        // eslint-disable-next-line no-irregular-whitespace
        newValue = newValue.replace(/ /g, " ");

        // State interne et envoi de la clé
        onChange(newValue);
        setValue(newValue);

        // Remplacement du texte par des points
        (e.target as HTMLElement).innerText = "•".repeat(newValue.length);

        // On déplace le curseur à la fin
        setCursorToEnd();
      }}
      autoCorrect="off"
      spellCheck="false"
      // Il est très important de laisser `tw-whitespace-pre-wrap` pour éviter
      // que le navigateur remplace les espaces par des espaces insécables.
      className="tw-whitespace-pre-wrap tw-mb-1.5 tw-block tw-w-full tw-rounded tw-border tw-border-main75 tw-bg-transparent tw-p-2.5 tw-text-black tw-outline-main tw-transition-all"
    />
  );
};

export default KeyInput;

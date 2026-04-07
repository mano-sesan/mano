import { useState, useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import API from "../../services/api";
import { deriveKeyFromCode, decryptBlob } from "../../services/shareEncryption";
import ButtonCustom from "../../components/ButtonCustom";

type ShareStatus = "loading" | "entering-code" | "deriving" | "downloading" | "success" | "error" | "expired";

export default function SharePublicPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<ShareStatus>("loading");
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [salt, setSalt] = useState("");
  const [shareInfo, setShareInfo] = useState<{ expiresAt: string; downloadCount: number; maxDownloads: number } | null>(null);

  useEffect(() => {
    async function checkShare() {
      try {
        const result = await API.get({ path: `/document-share/public/${token}` });
        if (!result.ok) {
          setStatus("expired");
          setError(result.error || "Ce lien n'est pas valide ou a expiré.");
          return;
        }
        setSalt(result.data.salt);
        setShareInfo(result.data);
        setStatus("entering-code");
      } catch {
        setStatus("error");
        setError("Impossible de contacter le serveur. Veuillez réessayer.");
      }
    }
    checkShare();
  }, [token]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!code.trim() || !salt) return;

      setStatus("deriving");
      setError("");

      try {
        const key = await deriveKeyFromCode(code.trim().toUpperCase(), salt);

        setStatus("downloading");
        const downloadResult = await API.downloadBlob({ path: `/document-share/public/${token}/download`, method: "POST" });

        if (!(downloadResult instanceof ArrayBuffer)) {
          setError(downloadResult.error || "Erreur lors du téléchargement.");
          setStatus("entering-code");
          return;
        }

        const encryptedData = new Uint8Array(downloadResult);

        let decryptedData: Uint8Array;
        try {
          decryptedData = await decryptBlob(encryptedData, key);
        } catch {
          setError("Code incorrect. Veuillez vérifier le code reçu et réessayer.");
          setStatus("entering-code");
          return;
        }

        const blob = new Blob([decryptedData], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "dossier-partage.pdf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setStatus("success");
      } catch {
        setError("Une erreur est survenue. Veuillez réessayer.");
        setStatus("entering-code");
      }
    },
    [code, salt, token]
  );

  const remainingDownloads = shareInfo ? shareInfo.maxDownloads - shareInfo.downloadCount : 0;

  return (
    <div className="tw-mx-10 tw-my-0 tw-w-full tw-max-w-lg tw-overflow-y-auto tw-overflow-x-hidden tw-rounded-lg tw-bg-white tw-px-7 tw-pb-2 tw-pt-10 tw-text-black tw-shadow-[0_0_20px_0_rgba(0,0,0,0.2)]">
      <h1 className="tw-mb-6 tw-text-center tw-text-3xl tw-font-bold">Partage sécurisé</h1>

      {status === "loading" && <p className="tw-mb-8 tw-text-center tw-text-base tw-text-black75">Vérification du lien en cours...</p>}

      {status === "expired" && (
        <>
          <p className="tw-mb-8 tw-px-8 tw-text-center tw-text-base tw-text-black75">{error}</p>
        </>
      )}

      {status === "error" && (
        <>
          <p className="tw-mb-4 tw-px-8 tw-text-center tw-text-base tw-text-black75">{error}</p>
          <ButtonCustom
            type="button"
            color="primary"
            title="Réessayer"
            onClick={() => window.location.reload()}
            className="tw-m-auto !tw-mt-4 !tw-mb-6 !tw-w-56 tw-font-[Helvetica] !tw-text-base tw-font-medium"
          />
        </>
      )}

      {(status === "entering-code" || status === "deriving" || status === "downloading") && (
        <>
          <p>
            Saisissez le code qui vous a été communiqué pour accéder au document.{" "}
            {shareInfo && remainingDownloads > 0 && (
              <span className="tw-text-black75">
                {remainingDownloads} téléchargement{remainingDownloads > 1 ? "s" : ""} restant{remainingDownloads > 1 ? "s" : ""}.
              </span>
            )}
          </p>

          <form onSubmit={handleSubmit} method="POST">
            <div className="tw-mb-6">
              <div className="tw-flex tw-flex-col-reverse">
                <input
                  name="code"
                  type="text"
                  id="code"
                  className="tw-mb-1.5 tw-block tw-w-full tw-rounded tw-border tw-border-main75 tw-bg-transparent tw-p-2.5 tw-text-center tw-text-xl tw-font-mono tw-tracking-widest tw-uppercase tw-text-black tw-outline-main tw-transition-all"
                  placeholder="Ex: K3XM7WP9"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  autoComplete="off"
                  disabled={status !== "entering-code"}
                  aria-invalid={!!error || undefined}
                  aria-describedby={error ? "error-code" : undefined}
                />
                <label htmlFor="code">Code d'accès</label>
              </div>
              {!!error && (
                <p className="tw-text-xs tw-text-red-500" id="error-code" role="alert">
                  {error}
                </p>
              )}
            </div>
            <ButtonCustom
              loading={status === "deriving" || status === "downloading"}
              disabled={code.length < 8}
              type="submit"
              color="primary"
              title={status === "deriving" ? "Déchiffrement en cours..." : status === "downloading" ? "Téléchargement..." : "Accéder au document"}
              className="tw-m-auto !tw-mt-8 !tw-mb-6 !tw-w-56 tw-font-[Helvetica] !tw-text-base tw-font-medium"
            />
          </form>
        </>
      )}

      {status === "success" && (
        <>
          <p className="tw-mb-8 tw-px-8 tw-text-center tw-text-base tw-text-black75">Le document a été téléchargé avec succès sur votre appareil.</p>
        </>
      )}
    </div>
  );
}

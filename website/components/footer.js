import { HiOutlineMail } from "react-icons/hi";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function Footer() {
  const guillaume = "Z3VpbGxhdW1lLmRlbWlyaGFuQHNlc2FuLmZy";
  const melissa = "bWVsaXNzYS5zYWl0ZXJAc2VzYW4uZnI=";
  const yoann = "eW9hbm4ua2l0dGVyeUBzZXNhbi5mcg==";
  const [emailGuillaume, setEmailGuillaume] = useState("");
  const [emailMelissa, setEmailMelissa] = useState("");
  const [emailYoann, setEmailYoann] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://dashboard-mano.fabrique.social.gouv.fr");

  const year = new Date().getFullYear();

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.location.hostname === "preprod-mano.sesan.fr") {
        setBaseUrl("https://preprod-espace-mano.sesan.fr");
      } else if (window.location.hostname === "mano.sesan.fr") {
        setBaseUrl("https://espace-mano.sesan.fr");
      }
    }
  }, []);

  useEffect(() => {
    setEmailGuillaume(window.atob(guillaume));
    setEmailMelissa(window.atob(melissa));
    setEmailYoann(window.atob(yoann));
  }, []);
  return (
    <>
      <section className="bg-shamrock-400 flex justify-center" id="contact">
        <div className="px-5 py-12 lg:py-24 lg:mx-24 md:container">
          <div className="grid grid-cols-2 gap-10">
            <div>
              <p className="mb-3  text-sm text-white text-center">
                Pour toutes questions sur les fonctionnalités de MANO, pour une présentation complète en présentiel ou commencer à utiliser l'outil
                {`\u00A0`}:<br />
                <span className=" block text-base  mt-3 font-medium ">
                  Mélissa et Yoann
                  <br />
                  chargés de déploiement
                </span>
              </p>
              <button
                className="mx-auto p-4 px-6 md:px-12 mt-2 space-x-2 text-white transition-all bg-white flex-center rounded-xl bg-opacity-10 hover:bg-opacity-30"
                onClick={() => {
                  window.location.href = "mailto:" + window && window.atob(melissa);
                }}
              >
                <HiOutlineMail className="text-lg" />
                <span suppressHydrationWarning className="text-base font-medium">
                  {emailMelissa}
                </span>
              </button>
              <button
                className="mx-auto p-4 px-6 md:px-12 mt-2 space-x-2 text-white transition-all bg-white flex-center rounded-xl bg-opacity-10 hover:bg-opacity-30"
                onClick={() => {
                  window.location.href = "mailto:" + window && window.atob(yoann);
                }}
              >
                <HiOutlineMail className="text-lg" />
                <span suppressHydrationWarning className="text-base font-medium">
                  {emailYoann}
                </span>
              </button>
            </div>
            <div>
              <p className="mb-2 text-sm text-center text-white">
                Pour toute question plus générale sur le projet ou pour établir un partenariat avec un autre service :
                <span className=" block text-base  mt-3 font-medium ">
                  Guillaume Demirhan,
                  <br />
                  porteur du projet
                </span>
              </p>
              <button
                className="mx-auto p-4 px-6 md:px-12 space-x-2 text-white transition-all bg-white flex-center rounded-xl bg-opacity-10 hover:bg-opacity-30"
                onClick={() => {
                  window.location.href = "mailto:" + window && window.atob(guillaume);
                }}
              >
                <HiOutlineMail className="text-lg" />
                <span suppressHydrationWarning className="text-base font-medium">
                  {emailGuillaume}
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-shamrock-500">
        <div className="flex flex-col items-center justify-center p-4 md:container md:flex-row md:justify-between">
          <a className="w-20 mb-10 md:mb-0" href="/">
            <img className="object-contain w-full h-full" src="/logo-white.png" alt="" />
          </a>
          <p className="text-xs text-white hover:underline">
            <Link href={baseUrl + "/legal.pdf"} target="_blank">
              Accessibilité : non conforme
            </Link>
          </p>
          <p className="text-xs text-white hover:underline">
            <Link href={baseUrl + "/legal.pdf"} target="_blank">
              Mentions légales
            </Link>
          </p>
          <p className="text-xs text-white hover:underline">
            <Link href={baseUrl + "/cgu.pdf"} target="_blank">
              Conditions générales d'utilisation
            </Link>
          </p>
          <p className="text-xs text-white hover:underline">
            <Link href="/stats">Statistiques</Link>
          </p>
          <p className="text-xs text-white hover:underline">
            <Link href={baseUrl + "/privacy.pdf"}>Politique de confidentialité</Link>
          </p>
        </div>
        <p className="pb-8 text-center text-xs text-white hover:underline">&copy; 2021-{year} Mano - Tous droits réservés</p>
      </section>
    </>
  );
}

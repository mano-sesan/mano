import { ModalBody, ModalContainer, ModalHeader } from "./tailwind/Modal";
import { Link } from "react-router-dom";
import { useRecoilValue } from "recoil";
import { organisationState } from "../recoil/auth";
import ButtonCustom from "./ButtonCustom";

//Organisation

const OnboardingEndModal = ({ open, setOpen }) => {
  const organisation = useRecoilValue(organisationState);

  return (
    <ModalContainer open={open} onClose={() => setOpen(false)} size="4xl">
      <ModalHeader title="C'est fini !" onClose={() => setOpen(false)} />
      <ModalBody className="tw-p-4">
        <div className="tw-text-center tw-mb-8 tw-mt-2">
          Vous avez chiffré votre organisation et créé votre première équipe&nbsp;:
          <br />
          vous pouvez désormais utiliser Mano&nbsp;!
        </div>
        <p>Que voulez-vous faire&nbsp;?</p>
        <ul>
          <li className="tw-mb-4">
            <b>Paramétrer Mano pour votre organisation :</b> l'activation de l'accueil de jour, l'import de vos données, la personnalisation, etc.{" "}
            <Link to={`/organisation/${organisation._id}`}>en cliquant ici</Link> ou dans le volet à gauche sur «&nbsp;Organisation&nbsp;»
          </li>
          <li className="tw-mb-4">
            <b>Ajouter d'autres utilisateurs :</b> <Link to={`/user`}>en cliquant ici</Link> ou dans le volet à gauche sur «&nbsp;Utilisateurs&nbsp;»
          </li>
          <li className="tw-mb-4">
            <b>Ajouter des personnes suivies</b> <Link to={`/person`}>en cliquant ici</Link> ou dans le volet à gauche sur «&nbsp;Personnes
            suivies&nbsp;». Puis des <Link to={`/action`}>actions</Link> et des <Link to={`/place`}>lieux fréquentés</Link> pour ces personnes. Ou
            bien ajouter des <Link to={`/territory`}>territoires</Link> que vous suivez, et enregistrer vos observations jour après jour.
          </li>
        </ul>
        <ButtonCustom onClick={() => setOpen(false)} title="C'est noté" style={{ margin: "20px auto" }} type="submit" />
      </ModalBody>
    </ModalContainer>
  );
};

export default OnboardingEndModal;

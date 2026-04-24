import { useHistory } from "react-router-dom";
import { ChevronLeftIcon } from "@heroicons/react/16/solid";

const BackButtonWrapper = ({ onClick, caption }) => {
  return (
    <button
      // className={`tw-cursor-pointer tw-flex tw-items-center noprint tw-text-main tw-text-sm tw-font-semibold tw-my-4 tw-leading-3 tw-rounded`}
      className="button-classic tw-flex tw-items-center tw-gap-1 ml-0 pl-2"
      type="button"
      aria-label="Retour"
      onClick={onClick}
    >
      <ChevronLeftIcon className="tw-w-4 tw-h-4" />

      {caption}
    </button>
  );
};

const BackButton = () => {
  const history = useHistory();
  return <BackButtonWrapper onClick={() => history.goBack()} caption="Retour" />;
};

export default BackButton;

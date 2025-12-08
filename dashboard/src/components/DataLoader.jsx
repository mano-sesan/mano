import { useAtomValue } from "jotai";

import { RandomPicture, RandomPicturePreloader } from "./LoaderRandomPicture";
import ProgressBar from "./LoaderProgressBar";
import { fullScreenState, isLoadingState, loadingTextState, progressState, totalState } from "../services/dataLoader";

export default function DataLoader() {
  const isLoading = useAtomValue(isLoadingState);
  const fullScreen = useAtomValue(fullScreenState);
  const loadingText = useAtomValue(loadingTextState);
  const progress = useAtomValue(progressState);
  const total = useAtomValue(totalState);

  if (!isLoading) return <RandomPicturePreloader />;
  if (!total && !fullScreen) return null;

  if (fullScreen) {
    return (
      <div className="tw-absolute tw-inset-0 tw-z-[1000] tw-box-border tw-flex tw-w-full tw-items-center tw-justify-center tw-bg-white">
        <div className="tw-flex tw-h-[50vh] tw-max-h-[50vw] tw-w-[50vw] tw-max-w-[50vh] tw-flex-col tw-items-center tw-justify-center">
          <RandomPicture />
          <ProgressBar progress={progress} total={total} loadingText={loadingText} />
        </div>
      </div>
    );
  }

  return (
    <div className="tw-absolute tw-left-0 tw-top-0 tw-z-[1000] tw-box-border tw-w-full">
      <ProgressBar progress={progress} total={total} loadingText={loadingText} />
    </div>
  );
}

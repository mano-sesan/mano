import { useStore } from "../store";
import { RandomPicture, RandomPicturePreloader } from "./LoaderRandomPicture";
import ProgressBar from "./LoaderProgressBar";

export default function DataLoader() {
  const isLoading = useStore((state) => state.isLoading);
  const fullScreen = useStore((state) => state.fullScreen);
  const loadingText = useStore((state) => state.loadingText);
  const progress = useStore((state) => state.progress);
  const total = useStore((state) => state.total);

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

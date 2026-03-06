import { useState, useEffect } from "react";

import picture1 from "../assets/loader-1.png";
import picture2 from "../assets/loader-2.png";
import picture3 from "../assets/loader-3.png";

function getRandomPicture() {
  return [picture1, picture3, picture2][new Date().getMinutes() % 3];
}

export function RandomPicturePreloader() {
  return (
    <div className="tw-fixed tw-top-0 tw-left-0 tw-size-0">
      <div className="tw-size-full tw-bg-contain tw-bg-center" style={{ backgroundImage: `url(${picture1})` }} />
      <div className="tw-size-full tw-bg-contain tw-bg-center" style={{ backgroundImage: `url(${picture2})` }} />
      <div className="tw-size-full tw-bg-contain tw-bg-center" style={{ backgroundImage: `url(${picture3})` }} />
    </div>
  );
}

export function RandomPicture() {
  const [picture, setPicture] = useState(getRandomPicture());
  useEffect(() => {
    setPicture(getRandomPicture());
  }, []);
  return <div className="tw-size-full tw-bg-contain tw-bg-center tw-bg-no-repeat" style={{ backgroundImage: `url(${picture})` }} />;
}

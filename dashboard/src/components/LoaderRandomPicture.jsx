import { useState, useEffect } from "react";
import styled from "styled-components";

import picture1 from "../assets/loader-1.png";
import picture2 from "../assets/loader-2.png";
import picture3 from "../assets/loader-3.png";

function getRandomPicture() {
  return [picture1, picture3, picture2][new Date().getMinutes() % 3];
}

export function RandomPicturePreloader() {
  return (
    <div className="fixed tw-inset-0">
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

const Hidden = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
`;

const Picture = styled.div`
  background-image: url(${(props) => props.src});
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center;
  width: 100%;
  height: 80%;
`;

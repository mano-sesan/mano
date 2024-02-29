/* eslint-disable max-len */
import React from 'react';
import styled from 'styled-components/native';
import Svg, { Path } from 'react-native-svg';

const SvgStyled = styled(Svg)``;

const TerritoryIcon = ({ color = '#000', size = 20 }) => (
  <SvgStyled width={size} height={size} viewBox="0 0 46 62">
    <Path
      d="M23 41.0001C26.5601 41.0001 30.0402 39.9444 33.0003 37.9666C35.9604 35.9887 38.2675 33.1775 39.6299 29.8884C40.9922 26.5994 41.3487 22.9802 40.6542 19.4885C39.9596 15.9968 38.2453 12.7895 35.728 10.2722C33.2106 7.75485 30.0033 6.04052 26.5117 5.34599C23.02 4.65145 19.4008 5.00791 16.1117 6.37029C12.8227 7.73267 10.0115 10.0398 8.03359 12.9999C6.05572 15.9599 5.00004 19.4401 5.00004 23.0001C5.00549 27.7723 6.90366 32.3475 10.2781 35.722C13.6526 39.0965 18.2278 40.9947 23 41.0001V41.0001ZM23 7.00012C26.1645 7.00012 29.258 7.93851 31.8892 9.69661C34.5203 11.4547 36.5711 13.9536 37.7821 16.8772C38.9931 19.8008 39.31 23.0179 38.6926 26.1216C38.0752 29.2253 36.5514 32.0762 34.3137 34.3138C32.0761 36.5515 29.2252 38.0753 26.1215 38.6927C23.0178 39.3101 19.8007 38.9932 16.8771 37.7822C13.9535 36.5712 11.4546 34.5204 9.69652 31.8892C7.93842 29.2581 7.00004 26.1646 7.00004 23.0001C7.00488 18.7581 8.69215 14.6913 11.6917 11.6918C14.6912 8.69223 18.7581 7.00496 23 7.00012V7.00012ZM14.4717 44.3609L22.1758 55.5665C22.2677 55.7003 22.3908 55.8096 22.5344 55.8852C22.678 55.9607 22.8378 56.0002 23 56.0002C23.1623 56.0002 23.3221 55.9607 23.4657 55.8852C23.6093 55.8096 23.7324 55.7003 23.8242 55.5665L31.5283 44.3609C36.4937 42.3785 40.6133 38.7281 43.1789 34.0373C45.7445 29.3466 46.5958 23.9086 45.5864 18.6583C44.577 13.4079 41.7701 8.67319 37.6481 5.26815C33.526 1.86312 28.3466 0.000488281 23 0.000488281C17.6535 0.000488281 12.474 1.86312 8.35203 5.26815C4.23002 8.67319 1.42303 13.4079 0.41365 18.6583C-0.595734 23.9086 0.25555 29.3466 2.82115 34.0373C5.38674 38.7281 9.50636 42.3785 14.4717 44.3609V44.3609ZM23 2.00012C27.9065 1.99981 32.6581 3.71749 36.4303 6.85501C40.2024 9.99253 42.7569 14.3518 43.6503 19.1762C44.5437 24.0006 43.7197 28.9856 41.3212 33.2658C38.9227 37.5461 35.1012 40.8514 30.52 42.608C30.3313 42.6806 30.1689 42.8086 30.0542 42.9752L23 53.235L15.9463 42.975C15.8318 42.8083 15.6694 42.6803 15.4805 42.6078C10.8995 40.8511 7.07821 37.5458 4.67984 33.2657C2.28146 28.9856 1.45743 24.0008 2.35076 19.1765C3.24409 14.3522 5.7984 9.99296 9.57034 6.85541C13.3423 3.71786 18.0937 2.00005 23 2.00012V2.00012ZM14 27.0001H19V32.0001C19 32.2653 19.1054 32.5197 19.2929 32.7072C19.4805 32.8948 19.7348 33.0001 20 33.0001H26C26.2653 33.0001 26.5196 32.8948 26.7071 32.7072C26.8947 32.5197 27 32.2653 27 32.0001V27.0001H32C32.2653 27.0001 32.5196 26.8948 32.7071 26.7072C32.8947 26.5197 33 26.2653 33 26.0001V20.0001C33 19.7349 32.8947 19.4806 32.7071 19.293C32.5196 19.1055 32.2653 19.0001 32 19.0001H27V14.0001C27 13.7349 26.8947 13.4806 26.7071 13.293C26.5196 13.1055 26.2653 13.0001 26 13.0001H20C19.7348 13.0001 19.4805 13.1055 19.2929 13.293C19.1054 13.4806 19 13.7349 19 14.0001V19.0001H14C13.7348 19.0001 13.4805 19.1055 13.2929 19.293C13.1054 19.4806 13 19.7349 13 20.0001V26.0001C13 26.2653 13.1054 26.5197 13.2929 26.7072C13.4805 26.8948 13.7348 27.0001 14 27.0001ZM15 21.0001H20C20.2653 21.0001 20.5196 20.8948 20.7071 20.7072C20.8947 20.5197 21 20.2653 21 20.0001V15.0001H25V20.0001C25 20.2653 25.1054 20.5197 25.2929 20.7072C25.4805 20.8948 25.7348 21.0001 26 21.0001H31V25.0001H26C25.7348 25.0001 25.4805 25.1055 25.2929 25.293C25.1054 25.4806 25 25.7349 25 26.0001V31.0001H21V26.0001C21 25.7349 20.8947 25.4806 20.7071 25.293C20.5196 25.1055 20.2653 25.0001 20 25.0001H15V21.0001ZM43 55.0001C43 59.4401 33.3115 61.8771 23.7417 61.9901C23.5176 62.0001 23.2534 62.0001 23 62.0001C22.7466 62.0001 22.4824 61.9996 22.23 61.9894C12.688 61.8771 3.00004 59.4401 3.00004 55.0001C3.00004 50.8995 10.9038 49.1954 14.3022 48.6529C14.4331 48.6295 14.5672 48.6324 14.6969 48.6614C14.8266 48.6904 14.9492 48.745 15.0576 48.822C15.166 48.8989 15.2579 48.9967 15.328 49.1096C15.3981 49.2225 15.4451 49.3482 15.466 49.4795C15.487 49.6107 15.4816 49.7448 15.4501 49.8739C15.4187 50.0031 15.3618 50.1246 15.2828 50.2315C15.2038 50.3384 15.1043 50.4285 14.9901 50.4965C14.876 50.5645 14.7494 50.609 14.6177 50.6275C8.30374 51.6358 5.00004 53.5901 5.00004 55.0001C5.00004 56.9986 11.5747 59.8639 22.2817 59.9901C22.5371 60.0001 22.7676 59.9975 23 60.0001C23.2319 60.0006 23.4629 60.0001 23.69 59.9913C34.4258 59.8639 41 56.9986 41 55.0001C41 53.5901 37.6963 51.6358 31.3828 50.6275C31.2508 50.6095 31.1237 50.5654 31.0091 50.4976C30.8944 50.4298 30.7944 50.3398 30.7149 50.2329C30.6355 50.1259 30.5782 50.0042 30.5465 49.8748C30.5148 49.7454 30.5093 49.6109 30.5302 49.4794C30.5512 49.3478 30.5982 49.2218 30.6685 49.1086C30.7389 48.9955 30.8311 48.8975 30.9399 48.8206C31.0486 48.7436 31.1716 48.6891 31.3017 48.6603C31.4318 48.6315 31.5663 48.629 31.6973 48.6529C35.0957 49.1954 43 50.8995 43 55.0001Z"
      id="TerritoryIcon"
      fill={color}
      fillRule="nonzero"
    />
  </SvgStyled>
);

export default TerritoryIcon;

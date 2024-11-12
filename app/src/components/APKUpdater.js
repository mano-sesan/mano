import React, { useState, useEffect } from 'react';
import { PERMISSIONS } from 'react-native-permissions';
import { Platform } from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import API from '../services/api';
import ProgressBar from './ProgressBar';
import getPermissionAsync from '../services/permissions';

const androidSDKVersion = Platform.Version;
const isAndroid13OrHigher = androidSDKVersion >= 33;

const APKUpdater = () => {
  const [downloadProgress, setDownloadProgress] = useState(0);

  const downloadAndInstallUpdate = async (apkUrl) => {
    setDownloadProgress(1);

    if (Platform.OS !== 'android') {
      console.log('APK updates are only supported on Android');
      return;
    }

    try {
      if (!isAndroid13OrHigher) {
        const permission = await getPermissionAsync({
          android: {
            permission: PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE,
            name: 'WRITE_EXTERNAL_STORAGE',
          },
        });
        if (!permission) {
          console.log('Storage permission denied');
          return;
        }
      }


      const downloadPath = `${RNBlobUtil.fs.dirs.DownloadDir}/mano-latest-${new Date().getTime()}.apk`;

      const options = {
        fileCache: true,
        addAndroidDownloads: {
          useDownloadManager: true,
          notification: true,
          mime: 'application/vnd.android.package-archive',
          path: downloadPath,
          mediaScannable: true,
          description: 'Downloading the latest update',
        },
      };

      console.log('Starting download:', { apkUrl, downloadPath });

      const response = await RNBlobUtil.config(options)
        .fetch('GET', apkUrl)
        .progress({ interval: 1000 }, (received, total) => {
          const progress = Math.max(1, Math.ceil((received / total) * 100));
          console.log(`Download progress: ${progress}%`);
          setDownloadProgress(progress);
        });

      const apkPath = response.path();
      // const apkPath = '/storage/emulated/0/Android/data/com.sesan.mano/files/Download/YourApp_latest.apk';
      console.log('Download completed:', apkPath);
      setDownloadProgress(100);
      // Verify the file exists
      const fileExists = await RNBlobUtil.fs.exists(apkPath);
      if (!fileExists) {
        throw new Error('Downloaded file not found');
      }

      // Install the APK - using the correct method name
      console.log('Installing APK', apkPath);
      await RNBlobUtil.android
        .actionViewIntent(apkPath, 'application/vnd.android.package-archive')
        .then(() => {
          console.log('APK installed');
          setDownloadProgress(0);
        })
        .catch((error) => {
          console.error('Error in downloadAndInstallUpdate:', error);
        });
    } catch (error) {
      console.error('Error in downloadAndInstallUpdate:', error);
      setDownloadProgress(0);
      throw error; // Re-throw the error for handling by the caller
    }
  };

  useEffect(() => {
    API.downloadAndInstallUpdate = downloadAndInstallUpdate;
  }, []);

  if (downloadProgress === 0) {
    return null;
  }
  return <ProgressBar loading="Téléchargement de la nouvelle version..." progress={downloadProgress / 100} fullScreen />;
};

export default APKUpdater;

import React, { useMemo } from "react";
import { useSetRecoilState, useRecoilValue } from "recoil";
import { v4 as uuidv4 } from "uuid";
import { customFieldsMedicalFileSelector, encryptMedicalFile, medicalFileState, prepareMedicalFileForEncryption } from "../../../recoil/medicalFiles";
import { CommentsModule } from "../../../components/CommentsGeneric";
import API from "../../../services/api";
import { toast } from "react-toastify";
import api from "../../../services/apiv2";
import { useDataLoader } from "../../../components/DataLoader";

const CommentsMedical = ({ person }) => {
  const customFieldsMedicalFile = useRecoilValue(customFieldsMedicalFileSelector);
  const setAllMedicalFiles = useSetRecoilState(medicalFileState);
  const { refresh } = useDataLoader();

  const medicalFile = person.medicalFile;
  const commentsMedical = useMemo(
    () => [...(person?.commentsMedical || [])].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)),
    [person]
  );

  return (
    <div className="tw-relative">
      <CommentsModule
        comments={commentsMedical}
        typeForNewComment="medical-file"
        color="blue-900"
        showPanel
        onDeleteComment={async (comment) => {
          const newMedicalFile = {
            ...medicalFile,
            comments: medicalFile.comments.filter((c) => c._id !== comment._id),
          };
          // optimistic UI
          setAllMedicalFiles((medicalFiles) => {
            return medicalFiles.map((_medicalFile) => {
              if (_medicalFile._id !== medicalFile._id) return _medicalFile;
              return newMedicalFile;
            });
          });
          const response = await api.put(`/medical-file/${medicalFile._id}`, await encryptMedicalFile(customFieldsMedicalFile)(newMedicalFile));
          if (!response.ok) return;
          toast.success("Commentaire supprimé");
          refresh();
        }}
        onSubmitComment={async (comment, isNewComment) => {
          const newMedicalFile = {
            ...medicalFile,
            comments: isNewComment
              ? [{ ...comment, _id: uuidv4() }, ...(medicalFile.comments || [])]
              : medicalFile.comments.map((c) => {
                  if (c._id === comment._id) {
                    return comment;
                  }
                  return c;
                }),
          };
          // optimistic UI
          setAllMedicalFiles((medicalFiles) => {
            return medicalFiles.map((_medicalFile) => {
              if (_medicalFile._id !== medicalFile._id) return _medicalFile;
              return newMedicalFile;
            });
          });
          const response = await api.put(`/medical-file/${medicalFile._id}`, await encryptMedicalFile(customFieldsMedicalFile)(newMedicalFile));
          if (!response.ok) return;
          toast.success("Commentaire enregistré");
          refresh();
        }}
      />
    </div>
  );
};

export default CommentsMedical;

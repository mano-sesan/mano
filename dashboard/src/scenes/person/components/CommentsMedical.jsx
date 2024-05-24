import { useMemo } from "react";
import { useRecoilValue } from "recoil";
import { v4 as uuidv4 } from "uuid";
import { customFieldsMedicalFileSelector, prepareMedicalFileForEncryption } from "../../../recoil/medicalFiles";
import { CommentsModule } from "../../../components/CommentsGeneric";
import API from "../../../services/api";
import { toast } from "react-toastify";
import { useDataLoader } from "../../../components/DataLoader";

const CommentsMedical = ({ person }) => {
  const { refresh } = useDataLoader();
  const customFieldsMedicalFile = useRecoilValue(customFieldsMedicalFileSelector);

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
          const response = await API.put({
            path: `/medical-file/${medicalFile._id}`,
            body: prepareMedicalFileForEncryption(customFieldsMedicalFile)(newMedicalFile),
          });
          if (!response.ok) return;
          toast.success("Commentaire supprimé");
          await refresh();
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
          const response = await API.put({
            path: `/medical-file/${medicalFile._id}`,
            body: prepareMedicalFileForEncryption(customFieldsMedicalFile)(newMedicalFile),
          });
          if (!response.ok) return;
          toast.success("Commentaire enregistré");
          await refresh();
        }}
      />
    </div>
  );
};

export default CommentsMedical;

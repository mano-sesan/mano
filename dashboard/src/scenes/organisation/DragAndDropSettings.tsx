import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import SortableJS from "sortablejs";
import { toast } from "react-toastify";
import ButtonCustom from "../../components/ButtonCustom";
import { ModalContainer, ModalBody, ModalFooter, ModalHeader } from "../../components/tailwind/Modal";
import { capture } from "../../services/sentry";
import DeleteButtonAndConfirmModal from "../../components/DeleteButtonAndConfirmModal";
import { CustomField } from "../../types/field";

type Item = CustomField | string;

interface DragAndDropGroup {
  groupTitle: string;
  items: Item[];
  editable?: boolean;
}

interface DragAndDropSettingsProps {
  data: DragAndDropGroup[];
  title: string;
  onDragAndDrop: (groups: DragAndDropGroup[]) => Promise<void>;
  addButtonCaption?: string;
  ItemComponent: React.ComponentType<{ item: Item; groupTitle: string }>;
  onGroupTitleChange?: (oldTitle: string, newTitle: string) => Promise<void>;
  NewItemComponent: React.ComponentType<{ groupTitle: string }>;
  dataItemKey?: (item: Item) => string;
  sectionId?: string;
  onAddGroup?: (groupTitle: string) => Promise<void>;
  onDeleteGroup?: (groupTitle: string) => Promise<void>;
}

const DragAndDropSettings: React.FC<DragAndDropSettingsProps> = ({
  title,
  data,
  onDragAndDrop,
  addButtonCaption,
  ItemComponent,
  onGroupTitleChange,
  NewItemComponent,
  dataItemKey = (item: Item) => (typeof item === "string" ? item : item.name),
  sectionId = "drag-and-drop-setting",
  onAddGroup = null,
  onDeleteGroup = null,
}) => {
  if (!title) throw new Error("title is required");
  if (!data) throw new Error("data is required");
  if (!onDragAndDrop) throw new Error("onDragAndDrop is required");

  const groupTitles = useMemo(() => data.map(({ groupTitle }) => groupTitle), [data]);

  const [addGroupModalVisible, setAddGroupModalVisible] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);

  const onAddGroupRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const groupTitle = formData.get("groupTitle") as string;
    if (!groupTitle) {
      toast.error("Le titre du groupe est obligatoire");
      return;
    }
    if (data.find((group) => group.groupTitle === groupTitle)) {
      toast.error("Ce groupe existe déjà");
      return;
    }
    if (onAddGroup) {
      await onAddGroup(groupTitle);
    }
    setAddGroupModalVisible(false);
  };

  const onDragAndDropRequest = useCallback(async () => {
    const groupsElements = gridRef.current?.querySelectorAll("[data-group]");
    if (!groupsElements) return;

    const groups = Array.from(groupsElements).map((group) => {
      const groupTitle = (group as HTMLElement).dataset.group!;
      return { groupTitle, items: [] as string[] };
    });

    for (const group of groups) {
      const categoriesElements = gridRef.current?.querySelectorAll(`[data-group="${group.groupTitle}"] [data-item]`);
      if (categoriesElements) {
        group.items = Array.from(categoriesElements).map((category) => (category as HTMLElement).dataset.item!);
      }
    }

    if (groups.length !== data.length) {
      capture(new Error("Drag and drop group error"), { extra: { groups, data, title } });
      toast.error("Désolé, une erreur est survenue lors du glisser/déposer. L'équipe technique a été prévenue. Vous pouvez réessayer");
      return;
    }
    if (
      groups.reduce((allItems, group) => [...allItems, ...group.items], [] as string[]).length !==
      data.reduce((allItems, group) => [...allItems, ...group.items], [] as any[]).length
    ) {
      capture(new Error("Drag and drop categories error"), { extra: { groups, data, title } });
      toast.error("Désolé, une erreur est survenue lors du glisser/déposer. L'équipe technique a été prévenue. Vous pouvez réessayer");
      return;
    }
    setIsDisabled(true);
    await onDragAndDrop(groups);
    setIsDisabled(false);
  }, [onDragAndDrop, data, title]);

  const gridRef = useRef<HTMLDivElement>(null);
  const sortableRef = useRef<SortableJS | null>(null);

  useEffect(() => {
    if (gridRef.current) {
      sortableRef.current = SortableJS.create(gridRef.current, {
        animation: 150,
        group: sectionId,
        onEnd: onDragAndDropRequest,
      });
    }
  }, [data, onDragAndDropRequest, sectionId]);

  return (
    <>
      <div className={["tw-my-10 tw-flex tw-items-center tw-gap-2", isDisabled ? "disable-everything" : ""].join(" ")}>
        {title}
        {!!addButtonCaption && (
          <ButtonCustom type="button" title={addButtonCaption} className="tw-ml-auto" onClick={() => setAddGroupModalVisible(true)} />
        )}
      </div>
      <hr />
      <div key={JSON.stringify(data)} className={isDisabled ? "tw-cursor-wait" : ""}>
        <div
          id="groups-grid"
          className={["tw--m-1 tw-inline-flex tw-w-full tw-flex-wrap", isDisabled ? "disable-everything" : ""].join(" ")}
          ref={gridRef}
        >
          {data.map(({ groupTitle, items, editable }) => (
            <Group
              key={groupTitle}
              groupTitle={groupTitle}
              editable={editable}
              items={items}
              onDragAndDrop={onDragAndDropRequest}
              groupTitles={groupTitles}
              ItemComponent={ItemComponent}
              dataItemKey={dataItemKey}
              onGroupTitleChange={onGroupTitleChange}
              onDeleteGroup={onDeleteGroup}
              NewItemComponent={NewItemComponent}
              sectionId={sectionId}
              isAlone={data.length === 1}
            />
          ))}
        </div>
      </div>
      <ModalContainer open={addGroupModalVisible}>
        <ModalHeader title="Ajouter un groupe" />
        <ModalBody className="tw-py-4">
          <form id="add-items-group-form" className="tw-flex tw-w-full tw-flex-col tw-gap-4 tw-px-8" onSubmit={onAddGroupRequest}>
            <div>
              <label htmlFor="groupTitle" className="tailwindui">
                Titre du groupe
              </label>
              <input type="text" id="groupTitle" name="groupTitle" placeholder="Titre du groupe" autoComplete="off" className="tailwindui" />
            </div>
          </form>
        </ModalBody>
        <ModalFooter>
          <button name="cancel" type="button" className="button-cancel" onClick={() => setAddGroupModalVisible(false)}>
            Annuler
          </button>
          <button type="submit" className="button-submit" form="add-items-group-form">
            Ajouter
          </button>
        </ModalFooter>
      </ModalContainer>
    </>
  );
};

interface GroupProps {
  groupTitle: string;
  items: any[];
  editable?: boolean;
  onDragAndDrop: () => Promise<void>;
  groupTitles: string[];
  onGroupTitleChange?: (oldTitle: string, newTitle: string) => Promise<void>;
  onDeleteGroup?: (groupTitle: string) => Promise<void>;
  ItemComponent: React.ComponentType<{ item: any; groupTitle: string }>;
  sectionId: string;
  NewItemComponent: React.ComponentType<{ groupTitle: string }>;
  dataItemKey: (item: any) => string;
  isAlone: boolean;
}

const Group: React.FC<GroupProps> = ({
  groupTitle,
  items,
  editable = true,
  onDragAndDrop,
  groupTitles,
  onGroupTitleChange,
  onDeleteGroup,
  ItemComponent,
  sectionId,
  NewItemComponent,
  dataItemKey,
  isAlone,
}) => {
  if (!groupTitle) throw new Error("groupTitle is required");
  if (!items) throw new Error("items is required");
  if (!onDragAndDrop) throw new Error("onDragAndDrop is required");
  if (!groupTitles) throw new Error("groupTitles is required");
  if (!ItemComponent) throw new Error("ItemComponent is required");
  if (!NewItemComponent) throw new Error("NewItemComponent is required");

  const listRef = useRef<HTMLDivElement>(null);
  const sortableRef = useRef<SortableJS | null>(null);
  const [isEditingGroupTitle, setIsEditingGroupTitle] = useState(false);

  useEffect(() => {
    if (listRef.current) {
      sortableRef.current = SortableJS.create(listRef.current, {
        animation: 150,
        group: `${sectionId}-items`,
        onEnd: onDragAndDrop,
      });
    }
  }, [onDragAndDrop, groupTitle, sectionId]);

  const onEditGroupTitle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newGroupTitle = formData.get("newGroupTitle") as string;
    const oldGroupTitle = groupTitle;
    if (!newGroupTitle) {
      toast.error("Vous devez saisir un nom pour le groupe");
      return;
    }
    if (newGroupTitle.trim() === oldGroupTitle.trim()) {
      toast.error("Le nom du groupe n'a pas changé");
      return;
    }
    if (groupTitles.find((title) => title === newGroupTitle)) {
      toast.error("Ce groupe existe déjà");
      return;
    }

    if (onGroupTitleChange) {
      await onGroupTitleChange(oldGroupTitle, newGroupTitle);
    }
    setIsEditingGroupTitle(false);
  };

  return (
    <>
      <div className={["tw-min-h-full tw-break-all tw-p-1 ", isAlone ? "" : "tw-basis-1/2 xl:tw-basis-1/3"].join(" ")}>
        <details
          open
          key={groupTitle}
          id={groupTitle}
          data-group={groupTitle}
          className="service-group tw-flex tw-min-h-full tw-flex-col tw-rounded-2xl tw-bg-main tw-bg-opacity-10 tw-p-4"
        >
          <summary className="tw-basis-full tw-text-sm tw-font-bold tw-tracking-wide tw-text-gray-700">
            <div className="tw-group tw-inline-flex tw-w-11/12 tw-shrink tw-justify-between">
              <span className="group-title tw-pl-2">
                {groupTitle} ({items.length})
              </span>
              {!!onGroupTitleChange && !!editable && (
                <button
                  type="button"
                  aria-label={`Modifier le groupe ${groupTitle}`}
                  className="tw-ml-auto tw-hidden group-hover:tw-inline-flex"
                  onClick={() => setIsEditingGroupTitle(true)}
                >
                  ✏️
                </button>
              )}
            </div>
          </summary>
          <div className="tw-mt-4 tw-flex tw-h-full tw-flex-col" ref={listRef}>
            {!items.length ? (
              <p className="tw-m-0 tw-text-xs tw-italic tw-opacity-30">Aucun élément dans ce groupe</p>
            ) : (
              items.map((item) => {
                return (
                  <div key={dataItemKey(item)} data-item={dataItemKey(item)}>
                    <ItemComponent item={item} groupTitle={groupTitle} />
                  </div>
                );
              })
            )}
          </div>
          <NewItemComponent groupTitle={groupTitle} />
        </details>
      </div>
      {!!onGroupTitleChange && (
        <ModalContainer open={isEditingGroupTitle}>
          <ModalHeader title={`Éditer le groupe: ${groupTitle}`} />
          <ModalBody className="tw-py-4">
            <form id="edit-category-group-form" className="tw-flex tw-w-full tw-flex-col tw-gap-4 tw-px-8" onSubmit={onEditGroupTitle}>
              <div>
                <label htmlFor="newGroupTitle" className="tailwindui">
                  Nouveau nom du groupe
                </label>
                <input type="text" id="newGroupTitle" name="newGroupTitle" placeholder={groupTitle} autoComplete="off" className="tailwindui" />
              </div>
            </form>
          </ModalBody>
          <ModalFooter>
            <button type="button" name="cancel" className="button-cancel" onClick={() => setIsEditingGroupTitle(false)}>
              Annuler
            </button>
            {!!onDeleteGroup && (
              <DeleteButtonAndConfirmModal
                title={`Voulez-vous vraiment supprimer le groupe ${groupTitle}`}
                textToConfirm={groupTitle}
                onConfirm={async () => {
                  await onDeleteGroup(groupTitle);
                  setIsEditingGroupTitle(false);
                }}
              >
                <span className="tw-mb-8 tw-block tw-w-full tw-text-center">
                  Cette opération est irréversible
                  <br />
                  et entrainera la suppression définitive de tous les éléments du groupe.
                </span>
              </DeleteButtonAndConfirmModal>
            )}
            <button type="submit" className="button-submit" form="edit-category-group-form">
              Enregistrer
            </button>
          </ModalFooter>
        </ModalContainer>
      )}
    </>
  );
};

export default DragAndDropSettings;

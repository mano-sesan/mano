import React, { Fragment } from "react";
import {
  createOnDropHandler,
  dragAndDropFeature,
  hotkeysCoreFeature,
  insertItemsAtTarget,
  keyboardDragAndDropFeature,
  removeItemsFromParents,
  selectionFeature,
  syncDataLoaderFeature,
} from "@headless-tree/core";
import { AssistiveTreeDescription, useTree } from "@headless-tree/react";
import cn from "classnames";

export type DemoItem = {
  name: string;
  children?: string[];
};

const sampleTree: Record<string, DemoItem> = {
  root: {
    name: "Root",
    children: ["fruit", "vegetables", "meals", "dessert", "drinks"],
  },
  fruit: {
    name: "Fruit",
    children: ["apple", "banana", "orange", "berries", "lemon"],
  },
  apple: { name: "Apple" },
  banana: { name: "Banana" },
  orange: { name: "Orange" },
  lemon: { name: "Lemon" },
  berries: { name: "Berries", children: ["red", "blue", "black"] },
  red: { name: "Red", children: ["strawberry", "raspberry"] },
  strawberry: { name: "Strawberry" },
  raspberry: { name: "Raspberry" },
  blue: { name: "Blue", children: ["blueberry"] },
  blueberry: { name: "Blueberry" },
  black: { name: "Black", children: ["blackberry"] },
  blackberry: { name: "Blackberry" },
  vegetables: {
    name: "Vegetables",
    children: ["tomato", "carrot", "cucumber", "potato"],
  },
  tomato: { name: "Tomato" },
  carrot: { name: "Carrot" },
  cucumber: { name: "Cucumber" },
  potato: { name: "Potato" },
  meals: {
    name: "Meals",
    children: ["america", "europe", "asia", "australia"],
  },
  america: { name: "America", children: ["burger", "hotdog", "pizza"] },
  burger: { name: "Burger" },
  hotdog: { name: "Hotdog" },
  pizza: { name: "Pizza" },
  europe: {
    name: "Europe",
    children: ["pasta", "paella", "schnitzel", "risotto", "weisswurst"],
  },
  pasta: { name: "Pasta" },
  paella: { name: "Paella" },
  schnitzel: { name: "Schnitzel" },
  risotto: { name: "Risotto" },
  weisswurst: { name: "Weisswurst" },
  asia: { name: "Asia", children: ["sushi", "ramen", "curry", "noodles"] },
  sushi: { name: "Sushi" },
  ramen: { name: "Ramen" },
  curry: { name: "Curry" },
  noodles: { name: "Noodles" },
  australia: {
    name: "Australia",
    children: ["potatowedges", "pokebowl", "lemoncurd", "kumarafries"],
  },
  potatowedges: { name: "Potato Wedges" },
  pokebowl: { name: "Poke Bowl" },
  lemoncurd: { name: "Lemon Curd" },
  kumarafries: { name: "Kumara Fries" },
  dessert: {
    name: "Dessert",
    children: ["icecream", "cake", "pudding", "cookies"],
  },
  icecream: { name: "Icecream" },
  cake: { name: "Cake" },
  pudding: { name: "Pudding" },
  cookies: { name: "Cookies" },
  drinks: { name: "Drinks", children: ["water", "juice", "beer", "wine"] },
  water: { name: "Water" },
  juice: { name: "Juice" },
  beer: { name: "Beer" },
  wine: { name: "Wine" },
};

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const createDemoData = (data = sampleTree) => {
  const syncDataLoader = {
    getItem: (id: string) => data[id],
    getChildren: (id: string) => data[id]?.children ?? [],
  };

  const asyncDataLoader = {
    getItem: (itemId: string) => wait(500).then(() => data[itemId]),
    getChildren: (itemId: string) => wait(800).then(() => data[itemId]?.children ?? []),
  };

  return { data, syncDataLoader, asyncDataLoader };
};

const { syncDataLoader, data } = createDemoData();
let newItemId = 0;
const insertNewItem = (dataTransfer: DataTransfer) => {
  const newId = `new-${newItemId++}`;
  data[newId] = {
    name: dataTransfer.getData("text/plain"),
  };
  return newId;
};

// story-start
export default function NewDocumentBlock() {
  const tree = useTree<DemoItem>({
    initialState: {
      expandedItems: ["fruit"],
      selectedItems: ["banana", "orange"],
    },
    rootItemId: "root",
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => !!item.getItemData().children,
    canReorder: true,
    onDrop: createOnDropHandler((item, newChildren) => {
      data[item.getId()].children = newChildren;
    }),
    onDropForeignDragObject: (dataTransfer, target) => {
      const newId = insertNewItem(dataTransfer);
      insertItemsAtTarget([newId], target, (item, newChildrenIds) => {
        data[item.getId()].children = newChildrenIds;
      });
    },
    onCompleteForeignDrop: (items) =>
      removeItemsFromParents(items, (item, newChildren) => {
        item.getItemData().children = newChildren;
      }),
    createForeignDragObject: (items) => ({
      format: "text/plain",
      data: items.map((item) => item.getId()).join(","),
    }),
    canDropForeignDragObject: (_, target) => target.item.isFolder(),
    indent: 20,
    dataLoader: syncDataLoader,
    features: [syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature, dragAndDropFeature, keyboardDragAndDropFeature],
  });

  return (
    <>
      <div {...tree.getContainerProps()} className="tw-flex tw-flex-col tw-gap-2 tw-items-start">
        <AssistiveTreeDescription tree={tree} />
        {tree.getItems().map((item) => (
          <button key={item.getId()} {...item.getProps()} style={{ paddingLeft: `${item.getItemMeta().level * 20}px` }}>
            <div
              className={cn("treeitem", {
                "tw-text-blue-500": item.isFocused(),
                "tw-text-green-500": item.isExpanded(),
                "tw-text-red-500": item.isSelected(),
                "tw-font-bold": item.isFolder(),
                drop: item.isDragTarget(),
              })}
            >
              {item.getItemName()}
            </div>
          </button>
        ))}
        <div style={tree.getDragLineStyle()} className="dragline" />
      </div>

      <div className="actionbar">
        <div
          className="foreign-dragsource"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", "hello world");
          }}
        >
          Drag me into the tree!
        </div>
        <div
          className="foreign-dropzone"
          onDrop={(e) => {
            alert(JSON.stringify(e.dataTransfer.getData("text/plain")));
            console.log(e.dataTransfer.getData("text/plain"));
          }}
          onDragOver={(e) => e.preventDefault()}
        >
          Drop items here!
        </div>
      </div>
    </>
  );
}

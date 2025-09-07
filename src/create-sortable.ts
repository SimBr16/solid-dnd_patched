import { createEffect, onCleanup, onMount } from "solid-js";

import { createDraggable } from "./create-draggable";
import { createDroppable } from "./create-droppable";
import { RefSetter, combineRefs } from "./combine-refs";
import { useSortableContext } from "./sortable-context";
import {
  Id,
  Listeners,
  Transformer,
  useDragDropContext,
} from "./drag-drop-context";
import { Layout, noopTransform, Transform, transformsAreEqual } from "./layout";
import { transformStyle } from "./style";

interface Sortable {
  (element: HTMLElement): void;
  ref: RefSetter<HTMLElement | null>;
  get transform(): Transform;
  get dragActivators(): Listeners;
  get isActiveDraggable(): boolean;
  get isActiveDroppable(): boolean;
}

const createSortable = (id: Id, data: Record<string, any> = {}): Sortable => {
  const [dndState, { addTransformer, removeTransformer }] =
    useDragDropContext()!;
  const [sortableState] = useSortableContext()!;
  const draggable = createDraggable(id, data);
  const droppable = createDroppable(id, data);
  const setNode = combineRefs(draggable.ref, droppable.ref);

  const initialIndex = (): number => sortableState.initialIds.indexOf(id);
  const currentIndex = (): number => sortableState.sortedIds.indexOf(id);
  const layoutById = (id: Id): Layout | null =>
    dndState.droppables[id]?.layout || null;

  const sortedTransform = (): Transform => {
    const delta = noopTransform();
    const resolvedInitialIndex = initialIndex();
    const resolvedCurrentIndex = currentIndex();

    if (resolvedCurrentIndex !== resolvedInitialIndex) {
      const currentLayout = layoutById(id);
      const draggableLayout = layoutById(dndState.active.draggableId!);

      if (currentLayout && draggableLayout) {
        if (currentLayout.x !== draggableLayout.x) {
          delta.x = draggableLayout.width;
        }
        if (currentLayout.y !== draggableLayout.y) {
          delta.y = draggableLayout.height;
        }
        if (resolvedCurrentIndex < resolvedInitialIndex) {
          delta.x *= -1;
          delta.y *= -1;
        }
      }
    }

    return delta;
  };

  const transformer: Transformer = {
    id: "sortableOffset",
    order: 100,
    callback: (transform) => {
      const delta = sortedTransform();
      return { x: transform.x + delta.x, y: transform.y + delta.y };
    },
  };

  onMount(() => addTransformer("droppables", id, transformer));
  onCleanup(() => removeTransformer("droppables", id, transformer.id));

  const transform = (): Transform => {
    return (
      (id === dndState.active.draggableId && !dndState.active.overlay
        ? dndState.draggables[id]?.transform
        : dndState.droppables[id]?.transform) || noopTransform()
    );
  };

  const linkTransformUpdates = (element: HTMLElement) => {
    createEffect(() => {
      const resolvedTransform = transform();
      if (!transformsAreEqual(resolvedTransform, noopTransform())) {
        const style = transformStyle(transform());
        element.style.setProperty("transform", style.transform ?? null);
      } else {
        element.style.removeProperty("transform");
      }
    });
  };

  const sortable = Object.defineProperties(
    (element: HTMLElement) => {
      draggable(element, () => ({ skipTransform: true }));
      droppable(element, () => ({ skipTransform: true }));
      linkTransformUpdates(element);
    },
    {
      ref: {
        enumerable: true,
        value: (element: HTMLElement) => {
          setNode(element);
          linkTransformUpdates(element);
        },
      },
      transform: {
        enumerable: true,
        get: transform,
      },
      isActiveDraggable: {
        enumerable: true,
        get: () => draggable.isActiveDraggable,
      },
      dragActivators: {
        enumerable: true,
        get: () => draggable.dragActivators,
      },
      isActiveDroppable: {
        enumerable: true,
        get: () => droppable.isActiveDroppable,
      },
    }
  ) as unknown as Sortable;

  return sortable;
};

export { createSortable };

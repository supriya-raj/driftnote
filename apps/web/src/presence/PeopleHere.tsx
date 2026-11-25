import { useEffect, useState } from "react";
import type { NoteSync } from "../sync/noteSync";
import { Avatar } from "./Avatar";

interface Person {
  clientId: number;
  name: string;
  color: string;
}

/** Everyone else currently in the note (from Yjs awareness), as a row of avatars. */
export function PeopleHere({ sync }: { sync: NoteSync }) {
  const people = usePeople(sync);
  if (people.length === 0) return null;
  const shown = people.slice(0, 4);
  const hidden = people
    .slice(4)
    .map((p) => p.name)
    .join(", ");
  return (
    <ul className="people-here" aria-label="People here">
      {shown.map((p) => (
        <li key={p.clientId} title={p.name}>
          <Avatar name={p.name} color={p.color} size={26} />
          <span className="visually-hidden">{p.name}</span>
        </li>
      ))}
      {people.length > shown.length && (
        <li className="people-more" title={hidden}>
          <span aria-hidden="true">+{people.length - shown.length}</span>
          <span className="visually-hidden">and {hidden}</span>
        </li>
      )}
    </ul>
  );
}

function usePeople(sync: NoteSync): Person[] {
  const awareness = sync.provider.awareness;
  const [people, setPeople] = useState<Person[]>([]);
  useEffect(() => {
    const read = (): void => {
      const others: Person[] = [];
      for (const [clientId, state] of awareness.getStates()) {
        if (clientId === awareness.clientID) continue;
        const user = (state as { user?: { name?: unknown; color?: unknown } }).user;
        if (typeof user?.name !== "string" || typeof user.color !== "string") continue;
        others.push({ clientId, name: user.name.slice(0, 40), color: user.color });
      }
      setPeople(others);
    };
    read();
    awareness.on("change", read);
    return () => awareness.off("change", read);
  }, [awareness]);
  return people;
}

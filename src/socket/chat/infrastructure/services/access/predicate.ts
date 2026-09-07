export function chatAccessPredicate(actor: string, target: string): string {
  const listed = (owner: string, contact: string) => `EXISTS (
    SELECT 1 FROM "CHATCONTACTOPERMITIDO" allowed
    WHERE allowed."CHATUSUREG" = ${owner} AND allowed."CONTACTO" = ${contact}
  )`;
  const closed = (owner: string) => `EXISTS (
    SELECT 1 FROM "CHATPOLITICA" policy
    WHERE policy."CHATUSUREG" = ${owner} AND policy."CONTACTOSCERRADOS" = TRUE
  )`;
  return `(
    ${actor} <> ${target}
    AND (NOT ${closed(actor)} OR ${listed(actor, target)})
    AND (NOT ${closed(target)} OR ${listed(target, actor)})
    AND (
      NOT EXISTS (SELECT 1 FROM "CHATPOLITICA" policy
        WHERE policy."CHATUSUREG" = ${target} AND policy."RESTRINGEENTRADA" = TRUE)
      OR ${listed(target, actor)}
      OR EXISTS (SELECT 1 FROM "CHATPOLITICA" policy
        WHERE policy."CHATUSUREG" = ${actor} AND policy."DESCUBRETODOS" = TRUE)
      OR EXISTS (SELECT 1 FROM "CHATENLACE" link
        WHERE link."CHATUSUREG1" = LEAST(${actor}, ${target})
          AND link."CHATUSUREG2" = GREATEST(${actor}, ${target}))
    )
  )`;
}

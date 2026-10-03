# OrchestrAV opened from an owner's agent's receipt (2026-10-03)

What Chase sees when he taps the link at the end of a receipt his agent got back from OTTO-Q
(`?source=agent&run=…&owner=…&tab=fleet&command=…`, otto-q-core 0605).

Rendered by the dev server over a RECORDED twin run (`src/lib/twin/__tests__/fixtures/live_capture.json`, the 36
real twin Teslas) and an owner board in exactly the shape `public.ottoq_owner_board` (otto-q-core 0606) returns.
0605/0606 are not applied yet, so nothing here is live state: the commands shown were built for the picture.

1. `1-receipt-all-teslas.jpg`: "change all Tesla maximum charging to 90%": the receipt on top, OTTO-Q's own words,
   and every card's target at 90% with "Max 90% · your agent". A command on every car rings no card.
2. `2-receipt-one-car-marked.jpg`: "send Tesla 45 to a service bay after charging": the one car it touched is
   ringed and listed first, with "Mechanical PM · this visit".
3. `3-set-by-your-agent-panel.jpg`: the Fleet tab's "Set by your agent" panel: what is in force, the reset rule,
   and each command with where it stands now (a refused "Tesla 98" included).
4. `4-receipt-phone.jpg`: the same receipt on a phone.

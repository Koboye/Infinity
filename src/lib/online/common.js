// Small helpers shared by every online game module.
export const finishRoom = (room, winner, reason = 'completed', detail = null) => ({
  ...room, status: 'finished', winner, reason, detail, deadline: null, drawOffer: null,
});

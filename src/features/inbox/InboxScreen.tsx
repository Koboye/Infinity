const send = async (msg?: string) => {
  const content = msg ?? text.trim();
  if (!content || !user || !otherId) return;
  if (content.length > 500) return;
  setSending(true); setText('');
  try {
    const token = await getIdToken();
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        conversationId: conv.id,
        text: content,
        otherId,
      }),
    });
    if (!res.ok) throw new Error('Failed to send');
  } catch {
    showToast('Failed to send message', 'error');
  } finally {
    setSending(false);
  }
};

export default function Privacy() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: 24, lineHeight: 1.6, fontFamily: 'inherit' }}>
      <h1>Privacy</h1>
      <p>Dimts processes the videos and voice recordings you give it to produce dubbed audio and translations.</p>
      <ul>
        <li><b>Conversation audio</b> (the other person) is processed in memory and never stored. Only the last seconds of <i>your own</i> voice are kept, in memory, for up to 30 minutes, to speak in your voice.</li>
        <li><b>Videos and voice samples</b> are used only for your job and deleted from the worker afterwards.</li>
        <li><b>My Fixes</b> (sentences and words you corrected) are saved to your account so they are remembered.</li>
        <li>Dubbed files are labelled AI-generated.</li>
        <li>Delete your fixes any time in My Fixes. To delete your account data, contact the operator of this service.</li>
      </ul>
      <p>Only clone a voice with the owner's permission. Tell people when you use a translator; some countries require consent.</p>
    </main>
  );
}

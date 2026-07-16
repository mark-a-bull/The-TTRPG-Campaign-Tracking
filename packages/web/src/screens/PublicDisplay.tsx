import { useParams } from "react-router-dom";
import { usePublicDisplay } from "../api/public-display.js";
import { ApiError } from "../api/client.js";

const styles = {
  page: {
    minHeight: "100vh",
    background: "#111318",
    color: "#e6e1e5",
    fontFamily: "system-ui, sans-serif",
    padding: "40px 48px",
  },
  campaignName: {
    fontSize: 20,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    color: "#a8adb5",
    margin: 0,
  },
  sessionTitle: {
    fontSize: 48,
    fontWeight: 700,
    margin: "4px 0 32px",
  },
  layout: {
    display: "flex",
    gap: 48,
    alignItems: "flex-start" as const,
  },
  sidebar: {
    flex: "0 0 280px",
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  section: {
    marginBottom: 40,
  },
  sectionLabel: {
    fontSize: 18,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    color: "#a8adb5",
    marginBottom: 16,
  },
  row: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 20,
  },
  column: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },
  card: {
    background: "#1f2229",
    borderRadius: 16,
    padding: 20,
    minWidth: 200,
  },
  rosterCard: {
    background: "#1f2229",
    borderRadius: 16,
    padding: 16,
    display: "flex",
    alignItems: "center" as const,
    gap: 16,
  },
  portrait: {
    width: 120,
    height: 120,
    borderRadius: 12,
    objectFit: "cover" as const,
    display: "block",
    marginBottom: 12,
  },
  rosterPortrait: {
    width: 56,
    height: 56,
    borderRadius: 10,
    objectFit: "cover" as const,
    display: "block",
    flexShrink: 0,
  },
  name: {
    fontSize: 24,
    fontWeight: 600,
  },
};

export function PublicDisplay() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { data, isLoading, error } = usePublicDisplay(campaignId);

  if (isLoading) {
    return (
      <div style={styles.page}>
        <p style={{ fontSize: 24 }}>Loading…</p>
      </div>
    );
  }

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div style={styles.page}>
        <p style={{ fontSize: 32 }}>Campaign not found.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={styles.page}>
        <p style={{ fontSize: 24 }}>Something went wrong.</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <p style={styles.campaignName}>{data.campaignName}</p>
      <h1 style={styles.sessionTitle}>{data.session ? data.session.title || "Session" : "Waiting for the GM…"}</h1>

      <div style={styles.layout}>
        <div style={styles.sidebar}>
          <div style={styles.sectionLabel}>Party</div>
          <div style={styles.column}>
            {data.partyMembers.map((pc) => (
              <div key={pc.id} style={styles.rosterCard}>
                {pc.portraitImageUrl ? <img src={pc.portraitImageUrl} alt="" style={styles.rosterPortrait} /> : null}
                <div style={styles.name}>{pc.name}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.main}>
          {data.session?.currentLocation ? (
            <div style={styles.section}>
              <div style={styles.sectionLabel}>Current Location</div>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                {data.session.currentLocation.imageUrl ? (
                  <img
                    src={data.session.currentLocation.imageUrl}
                    alt=""
                    style={{ width: 160, height: 160, borderRadius: 16, objectFit: "cover" }}
                  />
                ) : null}
                <div style={{ fontSize: 32, fontWeight: 600 }}>{data.session.currentLocation.name}</div>
              </div>
            </div>
          ) : null}

          {data.session && data.session.revealedClues.length > 0 ? (
            <div style={styles.section}>
              <div style={styles.sectionLabel}>Known Clues</div>
              <div style={styles.row}>
                {data.session.revealedClues.map((clue) => (
                  <div key={clue.id} style={{ ...styles.card, maxWidth: 320 }}>
                    <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{clue.title}</div>
                    {clue.content ? <div style={{ fontSize: 16, color: "#c8ccd4" }}>{clue.content}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {data.session?.battle ? (
            <div style={styles.section}>
              <div style={styles.sectionLabel}>Initiative Order</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}>
                {data.session.battle.entries.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      padding: "16px 20px",
                      borderRadius: 12,
                      fontSize: 24,
                      fontWeight: entry.isCurrent ? 700 : 400,
                      background: entry.isCurrent ? "#4a4266" : "#1f2229",
                      border: entry.isCurrent ? "2px solid #cfbcff" : "2px solid transparent",
                    }}
                  >
                    {entry.label}
                    {entry.isCurrent ? " — Current Turn" : ""}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

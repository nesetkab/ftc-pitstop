import React from "react";

interface AllianceTeamNameProps {
  eventCode: string;
  teamNumber: number;
}

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0"


export default function AllianceTeamName({ eventCode, teamNumber }: AllianceTeamNameProps) {
  const [teamName, setTeamName] = React.useState<string | null>(null);
  const auth = Buffer.from(`${process.env.FTC_USERNAME}:${process.env.FTC_API_KEY}`).toString("base64")
  const season = 2024

  React.useEffect(() => {
    async function fetchTeamName() {

      try {
        const response = await fetch(`${FTC_API_BASE}/${season}/events/${eventCode}/teams`, {
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: "application/json",
          },
        })

        const team = response.teams.find((t: { teamNumber: number }) => t.teamNumber === teamNumber);
        setTeamName(team ? team.teamName : null);
      } catch (e) {
        setTeamName(null);
        console.log("ahhhhh error")
      }
    }
    fetchTeamName();
  }, [eventCode, teamNumber]);

  return (
    <span>
      {teamNumber} - {teamName ? `: ${teamName}` : ""}
    </span>
  );
}

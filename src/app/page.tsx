import { eq, desc, sql, isNull } from "drizzle-orm";
import NameDialog from "@/components/NameDialog";
import { Separator } from "@/components/ui/separator";
import { db } from "@/db";
import { usersTable, joinsTable, activitiesTable } from "@/db/schema";
import ProfileButton from "@/components/ProfileButton";
import NewActivity from "@/components/NewActivity";
import Activity from "@/components/Activity";
import SearchBoxButton from "@/components/SearchBoxButton";

type HomePageProps = {
  searchParams: {
    username?: string;
    handle?: string;
  };
};

export default async function Home({
  searchParams: { username, handle },
}: HomePageProps) {
  if (username && handle) {
    await db
      .insert(usersTable)
      .values({
        displayName: username,
        handle,
      })
      .onConflictDoUpdate({
        target: usersTable.handle,
        set: {
          displayName: username,
        },
      })
      .execute();
  }
  
  const joinsSubquery = db.$with("joins_count").as(
    db
      .select({
        activityId: joinsTable.activityId,
        joins: sql<number | null>`count(*)`.mapWith(Number).as("joins"),
      })
      .from(joinsTable)
      .groupBy(joinsTable.activityId),
  );
  const joinedSubquery = db.$with("joined").as(
    db
      .select({
        activityId: joinsTable.activityId,
        joined: sql<number>`1`.mapWith(Boolean).as("joined"),
      })
      .from(joinsTable)
      .where(eq(joinsTable.userHandle, handle ?? "")),
  );
  const activities = await db
    .with(joinsSubquery, joinedSubquery)
    .select({
      id: activitiesTable.id,
      name: activitiesTable.name,
      username: usersTable.displayName,
      handle: usersTable.handle,
      joins: joinsSubquery.joins,
      createdAt: activitiesTable.createdAt,
      joined: joinedSubquery.joined,
      startTime: activitiesTable.startTime,
      dueTime: activitiesTable.dueTime
    })
    .from(activitiesTable)
    .where(isNull(activitiesTable.replyToActivityId))
    .orderBy(desc(activitiesTable.createdAt))
    .innerJoin(usersTable, eq(activitiesTable.userHandle, usersTable.handle))
    .leftJoin(joinsSubquery, eq(activitiesTable.id, joinsSubquery.activityId))
    .leftJoin(joinedSubquery, eq(activitiesTable.id, joinedSubquery.activityId))
    .execute();

  return (
    <>
      <div className="flex h-screen w-full max-w-2xl flex-col overflow-scroll pt-2">

        <div className="flex w-full flex-row p-3 items-center">
            <ProfileButton />
        </div>

        <Separator />

        <div className="flex w-full flex-row px-3 pt-3 pb-3 items-center gap-4">
          <SearchBoxButton/>
          <NewActivity/>
        </div>

        <Separator /> 

        {activities.map((activity) => (
          <Activity
            key={activity.id}
            id={activity.id}
            username={username}
            handle={handle}
            authorName={activity.username}
            authorHandle={activity.handle}
            name={activity.name}
            joins={activity.joins}
            joined={activity.joined}
            createdAt={activity.createdAt!}
          />
        ))}

      </div>

      <NameDialog />

    </>
  );
}
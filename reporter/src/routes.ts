import HealthController from "./controller/HealthController";
import LogController from "./controller/LogController";

export const Routes = [
    {
        method: "get",
        route: "/health",
        controller: HealthController,
        action: "version"
    },
    {
        method: "get",
        route: "/logs",
        controller: LogController,
        action: "logs"
    },
];
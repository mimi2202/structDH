// A project with no organisation (workspace_id null) is personal. Project URLs
// are /workspace/:workspaceId/projects/..., so personal projects use this id,
// and the all-projects list uses "all".
export const PERSONAL_WS = 'personal';
export const ALL_WS = 'all';
export const isPersonal = (project) => !project?.workspace_id;
export const projectWsId = (project) => project?.workspace_id || PERSONAL_WS;

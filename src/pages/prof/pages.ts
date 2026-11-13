// 교수 화면을 한 묶음으로 내보낸다. App.tsx 가 이 파일을 필요할 때 따로 받으므로 교수가 아닌 사용자는 교수 화면의 코드를 내려받지 않는다.
export { default as Dashboard } from './Dashboard'
export { default as NewAssignment } from './NewAssignment'
export { default as SetupLayout } from './setup/SetupLayout'
export { CompetenciesPage, MaterialsPage, PublishPage, RulesPage, TaskPage as SetupTaskPage, TestsPage, ToolsPage } from './setup/SetupPages'
export { StatusLayout, StatusLearning, StatusOverview, StatusPost, StatusPre, StatusStudents, StatusTask } from './status/StatusPages'
export { default as StudentLayout } from './student/StudentLayout'
export { ConversationTab, LearningTab, OverviewTab, TaskTab, TestsTab } from './student/StudentTabs'

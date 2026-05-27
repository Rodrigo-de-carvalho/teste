import TopBar from './TopBar'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function Layout({ children }) {
  return (
    <div className="min-h-dvh bg-background">
      <TopBar />
      <Sidebar />
      <main className="pt-20 pb-24 md:pb-8 px-5 md:px-10 max-w-[1440px] mx-auto min-h-dvh">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}

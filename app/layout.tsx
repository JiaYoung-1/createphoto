import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title:"俞总和小吴的图像生成工作站", description:"文字生成、图片修改与独立创作任务的私人图像工作站。",icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}

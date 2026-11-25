interface Props {
  children: React.ReactNode;
}

export function PageContainer({ children }: Props) {
  return <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-4 py-6 text-ink sm:px-6 lg:px-8">{children}</main>;
}

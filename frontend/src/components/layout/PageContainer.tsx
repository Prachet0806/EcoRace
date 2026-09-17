interface Props {
  wide?: boolean;
  children: React.ReactNode;
}

export function PageContainer({ wide = false, children }: Props) {
  return <main className={`mx-auto space-y-4 bg-base p-4 text-ink ${wide ? "max-w-6xl" : "max-w-5xl"}`}>{children}</main>;
}

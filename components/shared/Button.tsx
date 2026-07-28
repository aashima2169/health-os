type Props = {
  children: React.ReactNode;
  onClick?: () => void;
};

export default function Button({
  children,
  onClick,
}: Props) {
  return (
    <button
      onClick={onClick}
      className="
      w-full
      rounded-2xl
      bg-primary
      py-4
      font-semibold
      text-white
      transition
      hover:bg-primary/90"
    >
      {children}
    </button>
  );
}
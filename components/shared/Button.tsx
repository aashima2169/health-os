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
      bg-blue-600
      py-4
      font-semibold
      text-white
      transition
      hover:bg-blue-700"
    >
      {children}
    </button>
  );
}
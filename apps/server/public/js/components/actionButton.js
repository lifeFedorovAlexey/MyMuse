export const createActionButton = ({ label, className = "", onClick }) => {
  const button = document.createElement("button");
  if (className) {
    button.className = className;
  }
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
};

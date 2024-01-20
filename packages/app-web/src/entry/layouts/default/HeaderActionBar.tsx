import { Button } from 'antd';

function resolveButtonProps(action: Record<string, any>) {
  const resolved: Record<string, any> = {};

  if (action.primary === true) {
    resolved.type = 'primary';
  }

  return resolved;
}

function HeaderActionBar({ actions }: { actions: Record<string, any>[] }) {
  return (
    <div>
      {actions.map(action => (
        <Button key={action.text} {...resolveButtonProps(action)} onClick={action.execute}>{action.text}</Button>
      ))}
    </div>
  );
}

export default HeaderActionBar;

import { MessageBar, MessageBarTitle, MessageBarBody } from '@fluentui/react-components';

const DANGEROUS_FUNCTIONS = [
  'Web.Contents',
  'File.Contents',
  'Sql.Database',
  'AdoDotNet.Query',
  'Expression.Evaluate',
];

interface Props {
  mCode: string;
}

export function DangerousFunctionBanner({ mCode }: Props) {
  const found = DANGEROUS_FUNCTIONS.filter((fn) => mCode.includes(fn));
  if (found.length === 0) return null;

  return (
    <MessageBar intent="warning" style={{ flexShrink: 0 }}>
      <MessageBarBody>
        <MessageBarTitle>⚠ Potentially dangerous functions detected</MessageBarTitle>
        The query uses <strong>{found.join(', ')}</strong> which may access external data sources or
        execute arbitrary code. Review carefully before running.
      </MessageBarBody>
    </MessageBar>
  );
}

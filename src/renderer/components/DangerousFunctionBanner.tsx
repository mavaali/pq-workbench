import { useEffect, useState } from 'react';
import { MessageBar, MessageBarTitle, MessageBarBody } from '@fluentui/react-components';
import { findDangerousFunctions } from '../lsp/powerquery';

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
  const [found, setFound] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    findDangerousFunctions(mCode, DANGEROUS_FUNCTIONS)
      .then((hits) => {
        if (!cancelled) setFound(hits);
      })
      .catch(() => {
        if (!cancelled) {
          setFound(DANGEROUS_FUNCTIONS.filter((fn) => mCode.includes(fn)));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mCode]);

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

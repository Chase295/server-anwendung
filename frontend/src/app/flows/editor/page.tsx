'use client';

import { Suspense } from 'react';
import FlowEditor from '@/components/flow-editor/FlowEditor';

export default function FlowEditorPage() {
  return (
    <Suspense fallback={<div>Lade Editor...</div>}>
      <FlowEditor />
    </Suspense>
  );
}


import { describe, it, expect } from 'vitest';
import { createMap, addComponent, addService, addDataStore, sourceLocationsExist, unmappedSourceLocations, dependentsOf } from '../map/engine';
import { describeConfidence, estimateTokens, verdictFromSeverity, aggregateVerdicts, slugify } from '../core/knowledge';
import type { Component, DataStore, Service } from '../core/types';

describe('map engine', () => {
  it('creates an empty map', () => {
    const map = createMap('App', 'app');
    expect(map.components).toEqual([]);
    expect(map.modelVersion).toBe(0);
    expect(map.project.name).toBe('App');
  });

  it('adds and updates components by id', () => {
    let map = createMap('App', 'app');
    const c: Component = {
      id: 'svc',
      name: 'Service',
      purpose: 'x',
      responsibilities: [],
      inputs: [],
      outputs: [],
      dependencies: [],
      dependents: [],
      interfaces: [],
      failureModes: [],
      sourceLocations: ['src/svc.ts']
    };
    map = addComponent(map, c);
    expect(map.components.length).toBe(1);
    map = addComponent(map, { ...c, purpose: 'y' });
    expect(map.components.length).toBe(1);
    expect(map.components[0].purpose).toBe('y');
  });

  it('adds and updates services by id', () => {
    let map = createMap('App', 'app');
    const svc: Service = {
      id: 'svc-auth',
      name: 'Auth Service',
      purpose: 'Handles authentication',
      responsibilities: ['validate tokens'],
      dependencies: [],
      dependents: [],
      interfaces: [],
      failureModes: [],
      sourceLocations: []
    };
    map = addService(map, svc);
    expect(map.services.length).toBe(1);
    expect(map.services[0].id).toBe('svc-auth');
    map = addService(map, { ...svc, purpose: 'Updated purpose' });
    expect(map.services.length).toBe(1);
    expect(map.services[0].purpose).toBe('Updated purpose');
  });

  it('adds and updates data stores by id', () => {
    let map = createMap('App', 'app');
    const store: DataStore = {
      id: 'store-users',
      name: 'Users Store',
      purpose: 'Stores user data',
      tables: ['users'],
      dependencies: [],
      dependents: [],
      interfaces: [],
      failureModes: [],
      sourceLocations: []
    };
    map = addDataStore(map, store);
    expect(map.dataStores.length).toBe(1);
    expect(map.dataStores[0].id).toBe('store-users');
    map = addDataStore(map, { ...store, tables: ['users', 'sessions'] });
    expect(map.dataStores.length).toBe(1);
    expect(map.dataStores[0].tables).toEqual(['users', 'sessions']);
  });

  it('checks source location existence', () => {
    expect(sourceLocationsExist(['src/svc.ts'], ['src/svc.ts'])).toBe(true);
    expect(sourceLocationsExist(['src/svc/helper.ts'], ['src/svc/**'])).toBe(true);
    expect(sourceLocationsExist(['src/other.ts'], ['src/svc.ts'])).toBe(false);
    expect(sourceLocationsExist(['src/engine.test.ts'], ['src/**/*.test.ts'])).toBe(true);
    expect(sourceLocationsExist(['src/agents/adapter.test.ts'], ['src/**/*.test.ts'])).toBe(true);
    expect(sourceLocationsExist(['src/helpers.ts'], ['src/**/*.test.ts'])).toBe(false);
  });

  it('finds unmapped files', () => {
    const map = createMap('App', 'app');
    const withComp = addComponent(map, {
      id: 'svc',
      name: 'Service',
      purpose: 'x',
      responsibilities: [],
      inputs: [],
      outputs: [],
      dependencies: [],
      dependents: [],
      interfaces: [],
      failureModes: [],
      sourceLocations: ['src/svc/**']
    });
    const unmapped = unmappedSourceLocations(['src/svc/a.ts', 'src/secret/b.ts'], withComp);
    expect(unmapped).toEqual(['src/secret/b.ts']);
  });

  it('computes dependents through relationships', () => {
    const map = createMap('App', 'app');
    const withRel = {
      ...map,
      relationships: [
        { id: 'r1', from: 'a', to: 'b', type: 'uses' },
        { id: 'r2', from: 'b', to: 'c', type: 'uses' }
      ]
    };
    expect(dependentsOf(withRel, 'b')).toEqual(['a', 'c']);
  });
});

describe('knowledge helpers', () => {
  it('describes confidence bands', () => {
    expect(describeConfidence(0.1)).toBe('LOW');
    expect(describeConfidence(0.5)).toBe('MODERATE');
    expect(describeConfidence(0.8)).toBe('HIGH');
    expect(describeConfidence(0.95)).toBe('VERY HIGH');
    expect(describeConfidence(undefined)).toBe('UNKNOWN');
  });

  it('maps severity to verdicts', () => {
    expect(verdictFromSeverity('blocking')).toBe('BLOCK');
    expect(verdictFromSeverity('warning')).toBe('REVIEW');
    expect(verdictFromSeverity('advisory')).toBe('PASS');
  });

  it('aggregates verdicts worst-case', () => {
    expect(aggregateVerdicts(['PASS', 'PASS'])).toBe('PASS');
    expect(aggregateVerdicts(['PASS', 'REVIEW'])).toBe('REVIEW');
    expect(aggregateVerdicts(['PASS', 'BLOCK', 'REVIEW'])).toBe('BLOCK');
  });

  it('estimates tokens for ascii and unicode', () => {
    expect(estimateTokens('hello world')).toBe(3);
    expect(estimateTokens('')).toBe(0);
  });

  it('slugifies strings', () => {
    expect(slugify('Payment Service')).toBe('payment-service');
    expect(slugify('  Ordering Flow  ')).toBe('ordering-flow');
  });
});

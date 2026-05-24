declare module "yuka" {
  export class Vector3 {
    x: number; y: number; z: number;
    constructor(x?: number, y?: number, z?: number);
    set(x: number, y: number, z: number): this;
    copy(v: Vector3): this;
    clone(): Vector3;
    add(v: Vector3): this;
    addScalar(s: number): this;
    addVectors(a: Vector3, b: Vector3): this;
    sub(v: Vector3): this;
    subScalar(s: number): this;
    subVectors(a: Vector3, b: Vector3): this;
    multiply(v: Vector3): this;
    multiplyScalar(s: number): this;
    divide(v: Vector3): this;
    divideScalar(s: number): this;
    dot(v: Vector3): number;
    cross(v: Vector3): this;
    length(): number;
    squaredLength(): number;
    distanceTo(v: Vector3): number;
    squaredDistanceTo(v: Vector3): number;
    manhattanDistanceTo(v: Vector3): number;
    normalize(): this;
    fromArray(arr: number[], offset?: number): this;
    toArray(arr?: number[], offset?: number): number[];
    equals(v: Vector3): boolean;
  }

  export class Node {
    index: number;
    position: Vector3;
    constructor(index?: number);
  }

  export class Edge {
    from: number;
    to: number;
    cost: number;
    constructor(from: number, to: number, cost?: number);
  }

  export class Graph {
    constructor();
    addNode(node: Node): this;
    getNode(index: number): Node;
    addEdge(edge: Edge): this;
    getEdge(from: number, to: number): Edge;
    getNodesSize(): number;
    getEdgesSize(): number;
    clear(): this;
  }

  export class AStar {
    constructor(graph: Graph, source: number, target: number, heuristic?: any);
    search(): void;
    getPath(): Node[];
    found: boolean;
  }

  export const HeuristicPolicyEuclidSquared: any;
}

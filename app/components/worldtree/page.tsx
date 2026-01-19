import WorldTreeEngine from "./worldtree";
import NeuralNetwork from "./worldtree";


export default function WorldTreePage() {
    return (
        <div style={{ width: '100', height: 'calc(100vh - 48px)', position: 'relative' }}>
            <WorldTreeEngine />
        </div>
    );
}
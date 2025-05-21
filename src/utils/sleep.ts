export async function asyncSleep(time: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, time));
}

import * as core from '@actions/core'

type StringInputs = 'path'
type BooleanInputs = 'commit'

type Outputs = 'time'

const typedCore = {
  ...core,
  getInput: (inputName: StringInputs): string => core.getInput(inputName),
  getBooleanInput: (inputName: BooleanInputs): boolean =>
    core.getBooleanInput(inputName),
  setOutput: (outputName: Outputs, value: any) =>
    core.setOutput(outputName, value)
}

export default typedCore;
